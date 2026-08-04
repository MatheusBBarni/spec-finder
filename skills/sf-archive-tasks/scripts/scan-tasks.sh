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

  for task in "$directory"task_*.md; do
    [ -f "$task" ] || continue
    total=$((total + 1))
    status="$(status_of "$task")"
    if [ "$status" = "completed" ]; then
      completed=$((completed + 1))
    else
      other=$((other + 1))
      statuses="${statuses}${status:-missing},"
    fi
  done

  if [ "$total" -eq 0 ]; then
    verdict="EARLY-STAGE"
  elif [ "$completed" -eq "$total" ]; then
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
