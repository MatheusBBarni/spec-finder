#!/usr/bin/env bash
# Classify Spec Finder task packets without modifying them.
# Usage: scan-tasks.sh [tasks-dir] (default: .spec-finder/tasks)
set -u

TASKS_DIR="${1:-.spec-finder/tasks}"

if [ ! -d "$TASKS_DIR" ]; then
  echo "error: tasks dir not found: $TASKS_DIR" >&2
  exit 2
fi

status_of() {
  grep -m1 -iE '^status:[[:space:]]*' "$1" 2>/dev/null \
    | sed -E 's/^[Ss]tatus:[[:space:]]*//' \
    | tr '[:upper:]' '[:lower:]' \
    | tr -d '[:space:]'
}

frontmatter_checkpoint_field_of() {
  field="$2"
  awk -v field="$field" '
    BEGIN { frontmatter = 0; checkpoint = 0 }
    NR == 1 && $0 == "---" { frontmatter = 1; next }
    frontmatter && $0 == "---" { exit }
    !frontmatter { next }

    # Accept the dotted form as well as the block form so report-only
    # classification remains tolerant of equivalent frontmatter notation.
    $0 ~ ("^[[:space:]]*checkpoint[.]" field ":[[:space:]]*") {
      value = $0
      sub("^[[:space:]]*checkpoint[.]" field ":[[:space:]]*", "", value)
      print value
      exit
    }

    $0 ~ /^[[:space:]]*checkpoint:[[:space:]]*$/ { checkpoint = 1; next }
    checkpoint && $0 !~ /^[[:space:]]/ { checkpoint = 0 }
    checkpoint && $0 ~ ("^[[:space:]]+" field ":[[:space:]]*") {
      value = $0
      sub("^[[:space:]]+" field ":[[:space:]]*", "", value)
      print value
      exit
    }
  ' "$1" | sed -E "s/^[[:space:]]+//; s/[[:space:]]+$//; s/^['\"]//; s/['\"]$//"
}

checkpoint_state_of() {
  frontmatter_checkpoint_field_of "$1" state
}

checkpoint_error_of() {
  frontmatter_checkpoint_field_of "$1" error
}

printf '%-32s %-12s %-9s %-9s %-14s %s\n' "FOLDER" "VERDICT" "DONE" "TRACKED" "INDEX" "UNCHECKED"
printf '%-32s %-12s %-9s %-9s %-14s %s\n' "------" "-------" "----" "-------" "-----" "---------"

verdicts=""
found=0
for directory in "$TASKS_DIR"/*/; do
  [ -d "$directory" ] || continue
  found=1
  name="$(basename "$directory")"
  total=0
  completed=0
  other=0
  statuses=""
  blocked=0

  for task in "$directory"task_*.md; do
    [ -f "$task" ] || continue
    total=$((total + 1))
    status="$(status_of "$task")"
    checkpoint_state="$(checkpoint_state_of "$task")"
    if [ "$status" = "completed" ]; then
      completed=$((completed + 1))
      if [ "$checkpoint_state" = "blocked" ]; then
        blocked=$((blocked + 1))
        blocker="$(checkpoint_error_of "$task" | tr '\r\n\t' '   ' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"
        statuses="${statuses}checkpoint-blocked${blocker:+($blocker)},"
      fi
    else
      other=$((other + 1))
      statuses="${statuses}${status:-missing},"
    fi
  done

  if [ "$total" -eq 0 ]; then
    verdict="EARLY-STAGE"
  elif [ "$completed" -eq "$total" ] && [ "$blocked" -eq 0 ]; then
    verdict="DONE"
  else
    verdict="REMAINING"
  fi

  if [ -n "$(git ls-files "$directory" 2>/dev/null | head -1)" ]; then
    tracked="tracked"
  else
    tracked="untracked"
  fi

  index="noIndex"
  index_file="${directory}_tasks.md"
  if [ -f "$index_file" ]; then
    if grep -qiE '^\|.*status.*\|$' "$index_file" 2>/dev/null; then
      index_completed="$(grep -ciE '\|[[:space:]]*completed[[:space:]]*\|' "$index_file" 2>/dev/null)"
      if [ "$index_completed" = "$completed" ]; then
        index="indexMatch"
      else
        index="indexDrift($index_completed)"
      fi
    else
      index="indexNoStatus"
    fi
  fi

  unchecked="$(grep -rhE '^[[:space:]]*- \[ \]' "$directory" 2>/dev/null | wc -l | tr -d '[:space:]')"
  printf '%-32s %-12s %-9s %-9s %-14s %s\n' "$name" "$verdict" "$completed/$total" "$tracked" "$index" "$unchecked"
  verdicts="${verdicts}VERDICT	${name}	${verdict}	${completed}/${total}	${tracked}	${index}	${unchecked}	${statuses%,}
"
done

if [ "$found" -eq 0 ]; then
  echo "error: no task packets found in $TASKS_DIR" >&2
  exit 3
fi

echo
printf '%b' "$verdicts"
