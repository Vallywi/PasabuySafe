#!/bin/sh
# -----------------------------------------------------------------------------
# scripts/check-contract-id.sh
#
# CI guard for Requirement 8.10 of the pasabuy-management-enhancements spec:
# the contract id referenced in docs/*.md MUST agree with the canonical value
# of NEXT_PUBLIC_CONTRACT_ID in pasabuy-safe-web/.env.local.
#
# Behaviour:
#   1. Reads NEXT_PUBLIC_CONTRACT_ID from pasabuy-safe-web/.env.local.
#   2. Greps every *.md file under docs/ for the Stellar contract-id pattern
#      `C[A-Z0-9]{55}` (56 chars, leading C).
#   3. For each occurrence, asserts it equals the env value.
#   4. Exit 0  -> all occurrences match.
#      Exit 1  -> at least one mismatch (printed as file:line:mismatched-id).
#      Exit 2  -> setup/usage error (env file missing, key missing, etc.).
#
# Note: any 56-character `C…` literal in docs/ is treated as a Pasabuy contract
# id and checked. If you need to reference a *different* on-chain contract
# (e.g. the XLM token SAC), wrap it in a docs marker and exclude it from the
# regex, or extend this script to whitelist known sibling contracts.
#
# Usage:
#   bash scripts/check-contract-id.sh
#   sh   scripts/check-contract-id.sh
#
# Wiring this into CI (when a .github/workflows/ directory exists):
#   Add a step to the relevant workflow (e.g. .github/workflows/docs.yml):
#
#     - name: Check docs/contract-id agreement
#       run: bash scripts/check-contract-id.sh
#
#   No external dependencies are required beyond POSIX sh, grep, awk, sed.
# -----------------------------------------------------------------------------

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/pasabuy-safe-web/.env.local"
DOCS_DIR="$REPO_ROOT/docs"
CONTRACT_ID_RE='C[A-Z0-9]{55}'

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE" >&2
  exit 2
fi

if [ ! -d "$DOCS_DIR" ]; then
  echo "ERROR: docs directory not found at $DOCS_DIR" >&2
  exit 2
fi

# Extract NEXT_PUBLIC_CONTRACT_ID=… and strip the trailing newline/CR if any.
CANONICAL_ID=$(
  grep -E '^NEXT_PUBLIC_CONTRACT_ID=' "$ENV_FILE" \
    | head -n 1 \
    | cut -d= -f2- \
    | tr -d '\r\n'
)

if [ -z "$CANONICAL_ID" ]; then
  echo "ERROR: NEXT_PUBLIC_CONTRACT_ID is not set in $ENV_FILE" >&2
  exit 2
fi

if ! printf '%s' "$CANONICAL_ID" | grep -qE "^${CONTRACT_ID_RE}\$"; then
  echo "ERROR: NEXT_PUBLIC_CONTRACT_ID='$CANONICAL_ID' is not a valid Stellar contract id" >&2
  echo "       (expected pattern: $CONTRACT_ID_RE)" >&2
  exit 2
fi

# Whitelist of sibling contract ids that legitimately appear in docs and are
# NOT the PasabuySafe pasabuy contract (e.g. the XLM Stellar Asset Contract
# used as the escrow's token). Comma-separated. Extend via the
# CONTRACT_ID_WHITELIST env var without touching this file.
#
# Bundled whitelist:
#   CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC  = native XLM SAC (testnet)
DEFAULT_WHITELIST='CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
WHITELIST="${CONTRACT_ID_WHITELIST:-$DEFAULT_WHITELIST}"

# Find every (file, line, id) occurrence inside docs/*.md.
# grep -o emits one match per line; -H -n prefix file:line: to each.
MATCHES=$(grep -rHnoE --include='*.md' "$CONTRACT_ID_RE" "$DOCS_DIR" 2>/dev/null || true)

if [ -z "$MATCHES" ]; then
  echo "OK: no contract id literals found under $DOCS_DIR (nothing to verify)."
  exit 0
fi

# Print mismatches and count them.
# A match is a mismatch iff (a) id != expected AND (b) id is not on the
# whitelist of sibling contracts.
MISMATCHES=$(
  printf '%s\n' "$MATCHES" \
    | awk -F: \
        -v expected="$CANONICAL_ID" \
        -v whitelist_csv="$WHITELIST" '
        BEGIN {
          n = split(whitelist_csv, tokens, ",")
          for (i = 1; i <= n; i++) {
            w = tokens[i]
            gsub(/[[:space:]]/, "", w)
            if (length(w) > 0) whitelist[w] = 1
          }
        }
        {
          # Last :-separated field is the matched contract id.
          id = $NF
          if (id == expected) next
          if (id in whitelist) next
          print $0 " (expected " expected ")"
        }
      '
)

if [ -n "$MISMATCHES" ]; then
  printf '%s\n' "$MISMATCHES" >&2
  COUNT=$(printf '%s\n' "$MISMATCHES" | wc -l | tr -d ' ')
  echo "" >&2
  echo "FAILED: $COUNT contract-id mismatch(es) found in $DOCS_DIR." >&2
  echo "Expected canonical id: $CANONICAL_ID (from $ENV_FILE)" >&2
  exit 1
fi

TOTAL=$(printf '%s\n' "$MATCHES" | wc -l | tr -d ' ')
echo "OK: all $TOTAL contract-id reference(s) in $DOCS_DIR match $CANONICAL_ID."
exit 0
