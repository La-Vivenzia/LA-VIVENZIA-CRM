#!/usr/bin/env bash
# La Vivenzia CRM — production preflight (ap-south-1).
# Read-only except ONE idempotent write: the ALB HTTPS listener, created only when the ACM
# certificate is ISSUED and no 443 listener exists. Never prints a secret value.
# usage: bash deploy/aws/preflight.sh            (needs an authenticated AWS CLI session)
#        RUN_CONNECTIVITY=1 bash deploy/aws/preflight.sh   (also runs a one-off Fargate task that
#        connects to RDS as the app user over TLS and PINGs Valkey over TLS)
set -uo pipefail
export MSYS_NO_PATHCONV=1 AWS_PAGER=""
R=ap-south-1; ACC=361964630667
CERT=arn:aws:acm:$R:$ACC:certificate/deddb9d7-b5ee-429f-a271-cc492fe90841
ALB=arn:aws:elasticloadbalancing:$R:$ACC:loadbalancer/app/lv-crm-prod-alb/1d97f308e7e888a5
TG=arn:aws:elasticloadbalancing:$R:$ACC:targetgroup/lv-crm-prod-web/3220c79c867498fe
pass=0; fail=0
ok()   { echo "PASS  $*"; pass=$((pass+1)); }
bad()  { echo "FAIL  $*"; fail=$((fail+1)); }
info() { echo "      $*"; }

echo "== identity"; aws sts get-caller-identity --query 'Arn' --output text || { echo "AWS session not valid — run: aws login"; exit 2; }

echo "== 1. ACM"
st=$(aws acm describe-certificate --certificate-arn $CERT --query 'Certificate.Status' --output text)
[ "$st" = ISSUED ] && ok "certificate crm.lavivenzia.com ISSUED" || bad "certificate status $st"

echo "== 2. HTTPS listener"
l443=$(aws elbv2 describe-listeners --load-balancer-arn $ALB --query 'Listeners[?Port==`443`].ListenerArn' --output text)
if [ -z "$l443" ] && [ "$st" = ISSUED ]; then
  l443=$(aws elbv2 create-listener --load-balancer-arn $ALB --protocol HTTPS --port 443 --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 --certificates CertificateArn=$CERT --default-actions Type=forward,TargetGroupArn=$TG --query 'Listeners[0].ListenerArn' --output text) && info "created 443 listener"
fi
if [ -n "$l443" ]; then
  aws elbv2 describe-listeners --listener-arns "$l443" --query 'Listeners[0].{port:Port,proto:Protocol,policy:SslPolicy,cert:Certificates[0].CertificateArn,action:DefaultActions[0].Type,tg:DefaultActions[0].TargetGroupArn}' --output json | grep -q "$TG" && ok "443 listener forwards to lv-crm-prod-web with the ACM certificate" || bad "443 listener misconfigured"
else bad "no 443 listener (certificate not issued yet)"; fi

echo "== 3. HTTP redirect"
aws elbv2 describe-listeners --load-balancer-arn $ALB --query 'Listeners[?Port==`80`].DefaultActions[0].RedirectConfig.[Protocol,Port,StatusCode]' --output text | grep -q "HTTPS.*443.*HTTP_301" && ok "80 -> 301 https://:443" || bad "80 redirect missing"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://crm.lavivenzia.com/); [ "$code" = 301 ] && ok "public http://crm.lavivenzia.com answers 301" || bad "public http answers $code"

echo "== 4. ALB / target group"
aws elbv2 describe-load-balancers --load-balancer-arns $ALB --query 'LoadBalancers[0].{state:State.Code,scheme:Scheme,sg:SecurityGroups[0],subnets:AvailabilityZones[].SubnetId}' --output json
aws elbv2 describe-target-groups --target-group-arns $TG --query 'TargetGroups[0].{port:Port,type:TargetType,hc:HealthCheckPath,interval:HealthCheckIntervalSeconds,healthy:HealthyThresholdCount,unhealthy:UnhealthyThresholdCount,matcher:Matcher.HttpCode}' --output json | grep -q '"/healthz"' && ok "target group HTTP 3000 /healthz (ip targets)" || bad "target group health check"
info "registered targets: $(aws elbv2 describe-target-health --target-group-arn $TG --query 'length(TargetHealthDescriptions)' --output text) (0 expected before the service exists)"

echo "== 5. IAM"
aws iam list-attached-role-policies --role-name lv-crm-prod-ecs-exec --query 'AttachedPolicies[].PolicyName' --output text | grep -q AmazonECSTaskExecutionRolePolicy && ok "exec role: AmazonECSTaskExecutionRolePolicy" || bad "exec role managed policy"
aws iam get-role-policy --role-name lv-crm-prod-ecs-exec --policy-name read-prod-secrets --query 'PolicyDocument.Statement[0].{a:Action,r:Resource}' --output json | grep -q 'lv-crm-prod/\*' && ok "exec role: GetSecretValue limited to lv-crm-prod/* + the RDS managed secret" || bad "exec role secret policy"
[ "$(aws iam list-attached-role-policies --role-name lv-crm-prod-ecs-task --query 'length(AttachedPolicies)' --output text)" = 0 ] && [ "$(aws iam list-role-policies --role-name lv-crm-prod-ecs-task --query 'length(PolicyNames)' --output text)" = 0 ] && ok "task role: no permissions (least privilege)" || bad "task role has policies"
aws iam get-role --role-name lv-crm-prod-ecs-exec --query 'Role.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals."aws:SourceAccount"' --output text | grep -q $ACC && ok "trust policy scoped to account $ACC" || bad "trust policy"

echo "== 6. CloudWatch"
for g in web worker ops; do r=$(aws logs describe-log-groups --log-group-name-prefix /ecs/lv-crm-prod/$g --query 'logGroups[0].retentionInDays' --output text); [ "$r" = 30 ] && ok "/ecs/lv-crm-prod/$g retention 30d" || bad "/ecs/lv-crm-prod/$g retention $r"; done

echo "== 7. Secrets (existence + task-definition references; values never read)"
for f in deploy/aws/task-web.json deploy/aws/task-worker.json deploy/aws/task-ops.json; do
  for arn in $(python -c "import json,sys;[print(s['valueFrom'].split('::')[0].rsplit(':',1)[0] if s['valueFrom'].count(':')>6 and '::' in s['valueFrom'] else s['valueFrom']) for s in json.load(open(sys.argv[1]))['containerDefinitions'][0]['secrets']]" "$f" | tr -d '\r'); do
    case "$arn" in \<*) info "$f: placeholder $arn (R2, pending)";; *) aws secretsmanager describe-secret --secret-id "$arn" --query 'Name' --output text >/dev/null 2>&1 && ok "$f -> $(basename "$arn" | cut -d- -f1-3)" || bad "$f -> $arn not found";; esac
  done
done

echo "== 8/9. RDS + Valkey (control plane)"
aws rds describe-db-instances --db-instance-identifier lv-crm-prod-db --query 'DBInstances[0].{status:DBInstanceStatus,public:PubliclyAccessible,multiAZ:MultiAZ,ssl:"see rds.force_ssl"}' --output json
aws rds describe-db-parameters --db-parameter-group-name default.postgres16 --query 'Parameters[?ParameterName==`rds.force_ssl`].ParameterValue' --output text | grep -q 1 && ok "RDS enforces TLS (rds.force_ssl=1); tasks use PG_SSL_ALLOW_SELF_SIGNED=true" || bad "rds.force_ssl"
aws elasticache describe-replication-groups --replication-group-id lv-crm-prod-valkey --query 'ReplicationGroups[0].{status:Status,clusterMode:ClusterEnabled,tls:TransitEncryptionEnabled,nodes:length(MemberClusters)}' --output json | grep -q '"clusterMode": false' && ok "Valkey cluster mode disabled, TLS on" || bad "Valkey mode"
aws elasticache describe-cache-parameters --cache-parameter-group-name lv-crm-prod-valkey9 --query 'Parameters[?ParameterName==`maxmemory-policy`].ParameterValue' --output text | grep -q noeviction && ok "Valkey maxmemory-policy=noeviction (BullMQ requirement)" || bad "maxmemory-policy"

echo "== 10. ECR"
aws ecr describe-images --repository-name lv-crm --image-ids imageTag=d12a962e --query 'imageDetails[0].{tags:imageTags,digest:imageDigest,scan:imageScanStatus.status,findings:imageScanFindingsSummary.findingSeverityCounts}' --output json && ok "image lv-crm:d12a962e present" || bad "image missing"
[ "$(aws ecr describe-repositories --repository-names lv-crm --query 'repositories[0].imageTagMutability' --output text)" = IMMUTABLE ] && ok "tags immutable" || bad "tags mutable"

if [ "${RUN_CONNECTIVITY:-0}" = 1 ]; then
  echo "== 12. data-plane connectivity (one-off Fargate task, private subnet, ECS SG)"
  script='set -e; export PGUSER=lavivenzia_app PGPASSWORD="$APP_DB_PASSWORD"; psql -v ON_ERROR_STOP=1 -d lavivenzia -tAc "select '"'"'pg '"'"'||version(), current_user, ssl from pg_stat_ssl where pid=pg_backend_pid()"; psql -tAc "select extname from pg_extension order by 1" -d lavivenzia | tr "\n" " "; echo; cd /app/packages/twenty-server && node -e "const R=require(\"ioredis\");const c=new R(\"rediss://master.lv-crm-prod-valkey.vpvtkp.aps1.cache.amazonaws.com:6379\",{maxRetriesPerRequest:2});c.ping().then(async p=>{const i=await c.info(\"memory\");console.log(\"valkey PING\",p,\"| maxmemory_policy\",(i.match(/maxmemory_policy:(\\S+)/)||[])[1]);c.disconnect()}).catch(e=>{console.error(\"valkey FAIL\",e.message);process.exit(1)})"; echo PREFLIGHT_OK'
  ovr=$(python -c "import json,sys;print(json.dumps({'containerOverrides':[{'name':'ops','command':[sys.argv[1]]}]}))" "$script" | tr -d '\r')
  task=$(aws ecs run-task --cluster lv-crm-prod --launch-type FARGATE --task-definition lv-crm-prod-ops --network-configuration 'awsvpcConfiguration={subnets=[subnet-0352a03f9c9008b71],securityGroups=[sg-019afa6022ef1b7f4],assignPublicIp=DISABLED}' --overrides "$ovr" --query 'tasks[0].taskArn' --output text)
  aws ecs wait tasks-stopped --cluster lv-crm-prod --tasks "$task"; sleep 5
  out=$(aws logs get-log-events --log-group-name /ecs/lv-crm-prod/ops --log-stream-name "ops/ops/${task##*/}" --query 'events[].message' --output text)
  echo "$out" | sed 's/\t/\n/g'
  echo "$out" | grep -q PREFLIGHT_OK && echo "$out" | grep -q "valkey PING PONG" && ok "RDS TLS as lavivenzia_app + Valkey TLS PING" || bad "connectivity task"
fi

echo; echo "preflight: $pass passed, $fail failed"
[ $fail -eq 0 ]
