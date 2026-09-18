#!/usr/bin/env bash
# La Vivenzia CRM — steps 4–10 of the production sequence: task definitions, web service, worker service,
# verification and smoke tests. Idempotent: existing services are updated to the new task definition
# instead of duplicated. Refuses to run while any R2 placeholder is left in the task definitions
# (local storage is never used in production). Stops BEFORE the first sign-up / twenty-sdk apply.
# usage: bash deploy/aws/deploy-services.sh          (authenticated AWS CLI session)
set -euo pipefail
export MSYS_NO_PATHCONV=1 AWS_PAGER=""
R=ap-south-1; CLUSTER=lv-crm-prod
TG=arn:aws:elasticloadbalancing:$R:361964630667:targetgroup/lv-crm-prod-web/3220c79c867498fe
NET='awsvpcConfiguration={subnets=[subnet-0352a03f9c9008b71,subnet-074fecfeaa62c4436],securityGroups=[sg-019afa6022ef1b7f4],assignPublicIp=DISABLED}'
cd "$(dirname "$0")/../.."

echo "== guard: no placeholders, no local storage"
if grep -qE '<R2_|<CF_ACCOUNT_ID>' deploy/aws/task-web.json deploy/aws/task-worker.json; then echo "R2 placeholders still present — run deploy/aws/r2-provision.mjs first"; exit 2; fi
grep -q '"STORAGE_TYPE"' deploy/aws/task-web.json && ! grep -qE '"value": "local"' deploy/aws/task-web.json || { echo "STORAGE_TYPE must be S3"; exit 2; }
aws sts get-caller-identity --query 'Arn' --output text

echo "== 4. task definitions"
WEB_TD=$(aws ecs register-task-definition --cli-input-json file://deploy/aws/task-web.json --query 'taskDefinition.taskDefinitionArn' --output text); echo "web    $WEB_TD"
WORKER_TD=$(aws ecs register-task-definition --cli-input-json file://deploy/aws/task-worker.json --query 'taskDefinition.taskDefinitionArn' --output text); echo "worker $WORKER_TD"

svc_exists() { [ "$(aws ecs describe-services --cluster $CLUSTER --services "$1" --query 'services[?status!=`INACTIVE`] | length(@)' --output text)" != 0 ]; }

echo "== 5. web service"
if svc_exists lv-crm-prod-web; then
  aws ecs update-service --cluster $CLUSTER --service lv-crm-prod-web --task-definition "$WEB_TD" --desired-count 1 --query 'service.serviceName' --output text; echo "   (existing service updated — no duplicate)"
else
  aws ecs create-service --cluster $CLUSTER --service-name lv-crm-prod-web --task-definition "$WEB_TD" --desired-count 1 --launch-type FARGATE --platform-version LATEST \
    --network-configuration "$NET" --load-balancers "targetGroupArn=$TG,containerName=web,containerPort=3000" --health-check-grace-period-seconds 600 \
    --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200,deploymentCircuitBreaker={enable=true,rollback=true}" \
    --enable-execute-command --propagate-tags SERVICE --tags key=Project,value=lv-crm key=Environment,value=prod --query 'service.serviceName' --output text
fi

echo "== 6. wait for the web task and the ALB target"
aws ecs wait services-stable --cluster $CLUSTER --services lv-crm-prod-web
for i in $(seq 1 40); do
  h=$(aws elbv2 describe-target-health --target-group-arn $TG --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text)
  echo "   target health: $h"; [ "$h" = healthy ] && break; sleep 15
done
[ "$h" = healthy ] || { echo "web target never became healthy — see /ecs/lv-crm-prod/web"; exit 1; }

echo "== 7. worker service"
if svc_exists lv-crm-prod-worker; then
  aws ecs update-service --cluster $CLUSTER --service lv-crm-prod-worker --task-definition "$WORKER_TD" --desired-count 1 --query 'service.serviceName' --output text; echo "   (existing service updated — no duplicate)"
else
  aws ecs create-service --cluster $CLUSTER --service-name lv-crm-prod-worker --task-definition "$WORKER_TD" --desired-count 1 --launch-type FARGATE --platform-version LATEST \
    --network-configuration "$NET" --deployment-configuration "minimumHealthyPercent=0,maximumPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
    --enable-execute-command --propagate-tags SERVICE --tags key=Project,value=lv-crm key=Environment,value=prod --query 'service.serviceName' --output text
fi
aws ecs wait services-stable --cluster $CLUSTER --services lv-crm-prod-worker

echo "== 8. web → RDS / Valkey / R2 (from the logs; no secrets)"
web_task=$(aws ecs list-tasks --cluster $CLUSTER --service-name lv-crm-prod-web --query 'taskArns[0]' --output text); web_id=${web_task##*/}
worker_task=$(aws ecs list-tasks --cluster $CLUSTER --service-name lv-crm-prod-worker --query 'taskArns[0]' --output text); worker_id=${worker_task##*/}
sleep 20
web_log=$(aws logs get-log-events --log-group-name /ecs/lv-crm-prod/web --log-stream-name "web/web/$web_id" --limit 400 --query 'events[].message' --output text | tr '\t' '\n')
echo "$web_log" | grep -qE "Successfully migrated DB|Database setup and migrations are disabled" && echo "   RDS: migrations ran / schema ready" || echo "   RDS: migration line not found yet (check the stream)"
echo "$web_log" | grep -q "Successfully registered CronTrigger cron job" && echo "   Valkey/BullMQ: cron jobs registered (queue reachable)" || echo "   Valkey: cron registration line not found yet"
echo "$web_log" | grep -qiE "error.*(redis|ECONNREFUSED|ENOTFOUND|ssl|certificate)" && { echo "   ERRORS in web log:"; echo "$web_log" | grep -iE "error" | tail -5; } || echo "   web log: no connection errors"
worker_log=$(aws logs get-log-events --log-group-name /ecs/lv-crm-prod/worker --log-stream-name "worker/worker/$worker_id" --limit 200 --query 'events[].message' --output text | tr '\t' '\n')
echo "$worker_log" | grep -q "QueueWorkerModule dependencies initialized" && echo "   worker: queue worker up" || echo "   worker: not up yet"
echo "   R2: STORAGE_TYPE=S3 with the R2 endpoint is verified at the first upload (Twenty opens the bucket lazily); r2-provision.mjs already proved the credential with ListObjects"

echo "== 9. https://crm.lavivenzia.com end-to-end"
for i in $(seq 1 10); do code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://crm.lavivenzia.com/healthz); [ "$code" = 200 ] && break; sleep 10; done
echo "   /healthz -> $code"; [ "$code" = 200 ]
curl -s --max-time 20 https://crm.lavivenzia.com/healthz; echo
curl -s -o /dev/null -w '   / -> %{http_code} %{content_type}\n' --max-time 20 https://crm.lavivenzia.com/
curl -s --max-time 20 https://crm.lavivenzia.com/ | grep -o '<title>[^<]*</title>'
curl -s -o /dev/null -w '   http:// -> %{http_code} %{redirect_url}\n' --max-time 20 http://crm.lavivenzia.com/

echo "== 10. smoke: API up, no workspace yet, sign-up page served"
curl -s --max-time 20 -X POST https://crm.lavivenzia.com/graphql -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}' | head -c 200; echo
curl -s --max-time 20 https://crm.lavivenzia.com/client-config 2>/dev/null | head -c 300; echo
echo
echo "STOP: production is up. Next (manual, per the plan §12.11–12): first sign-up at https://crm.lavivenzia.com → Main Admin → API key → twenty-sdk apply → branding → app variables."
