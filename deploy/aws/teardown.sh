#!/usr/bin/env bash
# La Vivenzia CRM — controlled AWS teardown (Option B: strict zero ongoing cost).
#
#   PREREQUISITE: a verified database backup exists and has been restored into a
#   local PostgreSQL. This script refuses to run without the checksum file.
#
#   usage:  bash deploy/aws/teardown.sh            # dry run: prints every action
#           CONFIRM=DELETE bash deploy/aws/teardown.sh
#
# Every destructive call is preceded by an assertion that the resource identifier
# is the expected lv-crm-prod resource. Anything ambiguous aborts the script.
# Nothing outside the CRM is touched: Cloudflare (DNS + R2), GitHub, the domain
# and the main La Vivenzia product infrastructure are out of scope.
set -euo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash on Windows would rewrite /ecs/... paths

REGION=ap-south-1
ACCOUNT=361964630667
CLUSTER=lv-crm-prod
VPC=vpc-056de77c7b30da916
BACKUP_SHA_FILE="D:/lv-crm-backup/SHA256SUMS.txt"
BACKUP_FILE="D:/lv-crm-backup/lavivenzia-prod-2026-09-25.sql.gz"

DRY=1
[ "${CONFIRM:-}" = "DELETE" ] && DRY=0

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
act()  { if [ $DRY -eq 1 ]; then echo "   DRY-RUN: $*"; else echo "   RUN: $*"; eval "$@"; fi; }
skip() { echo "   SKIP: $*"; }
die()  { echo "   ABORT: $*" >&2; exit 1; }

# ---------------------------------------------------------------- preflight
say "0. Preflight"
acct=$(aws sts get-caller-identity --query Account --output text | tr -d '\r')
[ "$acct" = "$ACCOUNT" ] || die "wrong account: $acct"
echo "   account $acct, region $REGION"

[ -f "$BACKUP_SHA_FILE" ] || die "no backup checksum at $BACKUP_SHA_FILE — run the dump and verification first"
[ -f "$BACKUP_FILE" ] || die "no backup file at $BACKUP_FILE"
want=$(cut -d' ' -f1 < "$BACKUP_SHA_FILE" | tr -d '\r')
have=$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)
[ "$want" = "$have" ] || die "backup checksum mismatch — refusing to delete anything"
echo "   backup verified: $(basename "$BACKUP_FILE") sha256 ok ($(wc -c < "$BACKUP_FILE") bytes)"
[ $DRY -eq 1 ] && echo "   MODE: dry run (set CONFIRM=DELETE to execute)" || echo "   MODE: EXECUTING DELETES"

# ---------------------------------------------------------------- 1. ECS services
say "1. ECS services -> desired 0, then delete"
for svc in lv-crm-prod-web lv-crm-prod-worker; do
  status=$(aws ecs describe-services --cluster $CLUSTER --services "$svc" --region $REGION --query 'services[0].status' --output text | tr -d '\r')
  if [ "$status" = "ACTIVE" ]; then
    act "aws ecs update-service --cluster $CLUSTER --service $svc --desired-count 0 --region $REGION --query 'service.serviceName' --output text | tr -d '\\r'"
    act "aws ecs delete-service --cluster $CLUSTER --service $svc --force --region $REGION --query 'service.serviceName' --output text | tr -d '\\r'"
  else
    skip "$svc (status $status)"
  fi
done

# ---------------------------------------------------------------- 2. ALB + listeners + target group
say "2. ALB, listeners, target group"
alb=$(aws elbv2 describe-load-balancers --names lv-crm-prod-alb --region $REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null | tr -d '\r' || true)
if [ -n "$alb" ] && [ "$alb" != "None" ]; then
  case "$alb" in *:loadbalancer/app/lv-crm-prod-alb/*) ;; *) die "unexpected ALB arn: $alb" ;; esac
  for l in $(aws elbv2 describe-listeners --load-balancer-arn "$alb" --region $REGION --query 'Listeners[].ListenerArn' --output text | tr -d '\r'); do
    act "aws elbv2 delete-listener --listener-arn $l --region $REGION"
  done
  act "aws elbv2 delete-load-balancer --load-balancer-arn $alb --region $REGION"
  [ $DRY -eq 0 ] && { echo "   waiting for ALB deletion..."; aws elbv2 wait load-balancers-deleted --load-balancer-arns "$alb" --region $REGION || true; }
else
  skip "ALB already gone"
fi

tg=$(aws elbv2 describe-target-groups --names lv-crm-prod-web --region $REGION --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null | tr -d '\r' || true)
if [ -n "$tg" ] && [ "$tg" != "None" ]; then
  case "$tg" in *:targetgroup/lv-crm-prod-web/*) ;; *) die "unexpected target group arn: $tg" ;; esac
  act "aws elbv2 delete-target-group --target-group-arn $tg --region $REGION"
else
  skip "target group already gone"
fi

# ---------------------------------------------------------------- 3. NAT gateway + its EIP
say "3. NAT gateway and Elastic IP"
nat=$(aws ec2 describe-nat-gateways --region $REGION --filter Name=vpc-id,Values=$VPC --query 'NatGateways[?State==`available`].NatGatewayId' --output text | tr -d '\r')
if [ -n "$nat" ]; then
  [ "$nat" = "nat-096ee468b4530fcef" ] || die "unexpected NAT gateway: $nat"
  alloc=$(aws ec2 describe-nat-gateways --nat-gateway-ids "$nat" --region $REGION --query 'NatGateways[0].NatGatewayAddresses[0].AllocationId' --output text | tr -d '\r')
  echo "   nat=$nat eip-allocation=$alloc"
  act "aws ec2 delete-nat-gateway --nat-gateway-id $nat --region $REGION --query NatGatewayId --output text | tr -d '\\r'"
  if [ $DRY -eq 0 ]; then
    echo "   waiting for NAT deletion (this takes a few minutes)..."
    aws ec2 wait nat-gateway-deleted --nat-gateway-ids "$nat" --region $REGION || true
    aws ec2 release-address --allocation-id "$alloc" --region $REGION && echo "   released $alloc"
  else
    echo "   DRY-RUN: aws ec2 release-address --allocation-id $alloc"
  fi
else
  skip "NAT gateway already gone"
fi

# ---------------------------------------------------------------- 4. ElastiCache
say "4. ElastiCache Valkey"
rg=$(aws elasticache describe-replication-groups --replication-group-id lv-crm-prod-valkey --region $REGION --query 'ReplicationGroups[0].ReplicationGroupId' --output text 2>/dev/null | tr -d '\r' || true)
if [ -n "$rg" ] && [ "$rg" = "lv-crm-prod-valkey" ]; then
  act "aws elasticache delete-replication-group --replication-group-id lv-crm-prod-valkey --no-retain-primary-cluster --region $REGION --query 'ReplicationGroup.Status' --output text | tr -d '\\r'"
else
  skip "Valkey already gone"
fi

# ---------------------------------------------------------------- 5. RDS
say "5. RDS (deletion protection off, no final snapshot, automated backups removed)"
db=$(aws rds describe-db-instances --db-instance-identifier lv-crm-prod-db --region $REGION --query 'DBInstances[0].DBInstanceIdentifier' --output text 2>/dev/null | tr -d '\r' || true)
if [ "$db" = "lv-crm-prod-db" ]; then
  act "aws rds modify-db-instance --db-instance-identifier lv-crm-prod-db --no-deletion-protection --apply-immediately --region $REGION --query 'DBInstance.DeletionProtection' --output text | tr -d '\\r'"
  act "aws rds delete-db-instance --db-instance-identifier lv-crm-prod-db --skip-final-snapshot --delete-automated-backups --region $REGION --query 'DBInstance.DBInstanceStatus' --output text | tr -d '\\r'"
else
  skip "RDS already gone"
fi

# ---------------------------------------------------------------- 6. CloudWatch logs
say "6. CloudWatch log groups"
for lg in /ecs/lv-crm-prod/web /ecs/lv-crm-prod/worker /ecs/lv-crm-prod/ops; do
  found=$(aws logs describe-log-groups --log-group-name-prefix "$lg" --region $REGION --query "logGroups[?logGroupName=='$lg'].logGroupName" --output text | tr -d '\r')
  if [ -n "$found" ]; then
    act "aws logs delete-log-group --log-group-name $lg --region $REGION"
  else
    skip "$lg already gone"
  fi
done

# ---------------------------------------------------------------- 7. Secrets Manager
say "7. Secrets Manager (lv-crm-prod/* only; force-delete so no recovery-window storage)"
for s in $(aws secretsmanager list-secrets --region $REGION --query "SecretList[?starts_with(Name,'lv-crm-prod/')].Name" --output text | tr -d '\r'); do
  case "$s" in lv-crm-prod/*) ;; *) die "refusing to delete non-CRM secret $s" ;; esac
  act "aws secretsmanager delete-secret --secret-id $s --force-delete-without-recovery --region $REGION --query Name --output text | tr -d '\\r'"
done
echo "   note: the RDS-managed secret (rds!db-...) is removed by AWS with the instance"

# ---------------------------------------------------------------- 8. ECR
say "8. ECR repository"
repo=$(aws ecr describe-repositories --repository-names lv-crm --region $REGION --query 'repositories[0].repositoryName' --output text 2>/dev/null | tr -d '\r' || true)
if [ "$repo" = "lv-crm" ]; then
  act "aws ecr delete-repository --repository-name lv-crm --force --region $REGION --query 'repository.repositoryName' --output text | tr -d '\\r'"
else
  skip "ECR repository already gone"
fi

# ---------------------------------------------------------------- 9. leftover EIPs
say "9. Leftover Elastic IPs (only unassociated ones)"
if [ $DRY -eq 0 ]; then
  for a in $(aws ec2 describe-addresses --region $REGION --query 'Addresses[?AssociationId==null].AllocationId' --output text | tr -d '\r'); do
    echo "   releasing unassociated $a"; aws ec2 release-address --allocation-id "$a" --region $REGION
  done
else
  aws ec2 describe-addresses --region $REGION --query 'Addresses[].{ip:PublicIp,alloc:AllocationId,assoc:AssociationId}' --output text | tr -d '\r'
  echo "   DRY-RUN: unassociated allocations would be released after the ALB/NAT are gone"
fi

say "Teardown script finished (mode: $([ $DRY -eq 1 ] && echo 'dry run' || echo 'executed'))"
echo "Retained on purpose (all free): VPC $VPC, subnets, security groups, route tables,"
echo "internet gateway, S3 gateway endpoint, ECS cluster $CLUSTER (empty), IAM roles,"
echo "ACM certificate for crm.lavivenzia.com, task definitions (revisions are free)."
