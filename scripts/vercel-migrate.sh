#!/usr/bin/env bash
# ============================================================================
# MIZANORA — Vercel account migration helper
# ============================================================================
# Naye Vercel account par project banana + saari env vars daalna + GitHub repo connect karna.
# (Vercel ka web dashboard bhi kar sakta hai; ye script bar bar paste karne se bachaati hai.)
#
#   NEW_VERCEL_TOKEN set karein:  export NEW_VERCEL_TOKEN="vcp_..."
#   phir:                         bash scripts/vercel-migrate.sh
#
# Token banane ka tareeqa: Vercel -> Account Settings -> Tokens -> Create
#   Scope: naya account/team, Expiration: 1 day (kaam hone ke baad revoke kar dein)
#
# Note: values .env.vercel-backup se parhi jaati hain — wo file git me nahi jati.
# ============================================================================
set -uo pipefail

API="https://api.vercel.com"
TOKEN="${NEW_VERCEL_TOKEN:-}"
ENVFILE="${ENVFILE:-.env.vercel-backup}"
PROJECT_NAME="${PROJECT_NAME:-mizanora}"
GIT_REPO="${GIT_REPO:-Mizanora-org/MIZANORA}"

die() { echo "ERROR: $*" >&2; exit 1; }
jqget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=$1;console.log(v===undefined||v===null?'':v)}catch(e){console.log('')}})"; }
api() { # api METHOD PATH [BODY]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body"
  else
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $TOKEN"
  fi
}

[ -n "$TOKEN" ] || die "NEW_VERCEL_TOKEN set nahi hai. export NEW_VERCEL_TOKEN=\"vcp_...\" karke dobara chalayein."
[ -f "$ENVFILE" ] || die "$ENVFILE nahi mili (repo root se chalayein)."
command -v curl >/dev/null || die "curl chahiye."
command -v node >/dev/null || die "node chahiye."

echo "== 1. Token check =="
USER_JSON="$(api GET /v2/user)"
USER_NAME="$(printf '%s' "$USER_JSON" | jqget 'o.user&&o.user.username')"
[ -n "$USER_NAME" ] || { echo "$USER_JSON" | head -c 400; die "Token invalid ya expire ho gaya."; }
echo "   account: $USER_NAME"

echo "== 2. Team scope (agar naye account me team hai) =="
TEAMS="$(api GET /v2/teams?limit=20)"
TEAM_ID="$(printf '%s' "$TEAMS" | jqget '(o.teams&&o.teams[0]&&o.teams[0].id)')"
TEAM_NAME="$(printf '%s' "$TEAMS" | jqget '(o.teams&&o.teams[0]&&o.teams[0].slug)')"
if [ -n "$TEAM_ID" ]; then
  echo "   team: $TEAM_NAME ($TEAM_ID)"
  Q="?teamId=$TEAM_ID"
else
  echo "   team: (personal account)"
  Q=""
fi

echo "== 3. GitHub repo connect + project create =="
BODY=$(node -e '
const [repo] = process.argv.slice(1);
process.stdout.write(JSON.stringify({
  name: process.env.PROJECT_NAME || "mizanora",
  framework: "nextjs",
  gitRepository: { type: "github", repo },
  buildCommand: null, installCommand: null, outputDirectory: null,
}));' "$GIT_REPO")
CREATED="$(api POST "/v10/projects$Q" "$BODY")"
PROJECT_ID="$(printf '%s' "$CREATED" | jqget 'o.id')"
if [ -z "$PROJECT_ID" ]; then
  echo "   create nahi hua — shayad project pehle se hai. Response:"
  printf '%s' "$CREATED" | head -c 600; echo
  EXISTING="$(api GET "/v9/projects/$PROJECT_NAME$Q")"
  PROJECT_ID="$(printf '%s' "$EXISTING" | jqget 'o.id')"
  [ -n "$PROJECT_ID" ] || die "Project create bhi nahi hua aur mila bhi nahi. GitHub integration dashboard se connect karein."
  echo "   maujooda project use ho raha hai: $PROJECT_ID"
else
  echo "   project bana: $PROJECT_ID ($PROJECT_NAME)"
fi

echo "== 4. Environment variables (Production + Preview + Development) =="
added=0; skipped=0
while IFS= read -r line || [ -n "$line" ]; do
  # comments / blank / khaali values skip
  case "$line" in ''|'#'*) continue;; esac
  key="${line%%=*}"; val="${line#*=}"
  [ -n "$key" ] || continue
  if [ -z "${val// /}" ]; then
    echo "   skip  $key   (value khaali — khud bharein)"; skipped=$((skipped+1)); continue
  fi
  PAYLOAD=$(node -e '
    const [k,v] = process.argv.slice(1);
    process.stdout.write(JSON.stringify({ key:k, value:v, type:"encrypted",
      target:["production","preview","development"] }));' "$key" "$val")
  OUT="$(api POST "/v10/projects/$PROJECT_ID/env?upsert=true$([ -n "$TEAM_ID" ] && echo "&teamId=$TEAM_ID")" "$PAYLOAD")"
  if printf '%s' "$OUT" | grep -q '"error"'; then
    echo "   FAIL  $key   -> $(printf '%s' "$OUT" | head -c 160)"; skipped=$((skipped+1))
  else
    echo "   ok    $key"; added=$((added+1))
  fi
done < "$ENVFILE"
echo "   added: $added   skipped: $skipped"

echo "== 5. Cron + build settings =="
api PATCH "/v9/projects/$PROJECT_ID$Q" '{"framework":"nextjs","buildCommand":null,"installCommand":"npm install","outputDirectory":null}' >/dev/null \
  && echo "   settings ok"

echo "== 6. Production deploy (main branch) =="
DEP="$(api POST "/v13/deployments$Q" "$(node -e 'process.stdout.write(JSON.stringify({name:process.env.PROJECT_NAME||"mizanora", target:"production", gitSource:{type:"github", repo:process.env.GIT_REPO||"Mizanora-org/MIZANORA", ref:"main"}}))')")"
DEP_URL="$(printf '%s' "$DEP" | jqget 'o.url')"
DEP_ID="$(printf '%s' "$DEP" | jqget 'o.id')"
[ -n "$DEP_URL" ] || { printf '%s' "$DEP" | head -c 500; echo; die "Deploy start nahi hua."; }
echo "   deployment: https://$DEP_URL  ($DEP_ID)"
echo "   logs: https://vercel.com/dashboard  ->  Deployments"

cat <<EOF

================= AGLA QADAM =================
1) Deploy khatam hone ka intezar karein (~2-3 min).
2) Vercel -> project -> Settings -> Domains -> "mizanora.vercel.app" add karein.
   (Ye global naam hai: PURANA project delete hone ke baad hi milega.)
3) Test karein: /  ,  /product/<slug>  ,  /admin  ,  /api/health
4) Usage -> Fast Origin Transfer graph dekhein (v60 ke baad flat rehna chahiye).
5) Kaam khatam -> is token ko Vercel me REVOKE kar dein.
EOF
