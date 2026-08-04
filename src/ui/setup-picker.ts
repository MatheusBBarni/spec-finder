import { emitKeypressEvents, type Key } from "node:readline"
import type { Readable, Writable } from "node:stream"

export interface SetupPickerInput extends Readable {
  isTTY?: boolean
  isRaw?: boolean
  setRawMode?: (mode: boolean) => void
}

export interface SetupPickerItem<T> {
  label: string
  value: T
  hint?: string
}

export class SetupCancelledError extends Error {
  constructor() {
    super("setup cancelled")
    this.name = "SetupCancelledError"
  }
}

interface PickerOptions<T> {
  message: string
  items: SetupPickerItem<T>[]
  input: SetupPickerInput
  output: Writable
  multiple: boolean
  initialSelected?: T[]
  required?: boolean
}

export async function setupMultiSelect<T>(options: Omit<PickerOptions<T>, "multiple">): Promise<T[]> {
  return runSetupPicker({ ...options, multiple: true })
}

export async function setupSelect<T>(options: Omit<PickerOptions<T>, "multiple" | "initialSelected" | "required">): Promise<T> {
  const selected = await runSetupPicker({ ...options, multiple: false })
  return selected[0]!
}

async function runSetupPicker<T>(options: PickerOptions<T>): Promise<T[]> {
  if (options.items.length === 0) throw new Error("setup picker requires at least one option")

  return new Promise<T[]>((resolve, reject) => {
    let cursor = 0
    let validationError = false
    let renderedLines = 0
    const selected = new Set(options.initialSelected ?? [])
    const wasRaw = options.input.isRaw === true
    const wasFlowing = options.input.readableFlowing === true

    emitKeypressEvents(options.input)
    options.input.resume()
    if (options.input.isTTY && options.input.setRawMode) options.input.setRawMode(true)

    const render = (state: "active" | "submitted" | "cancelled" = "active"): void => {
      const lines: string[] = []
      const icon = state === "active" ? "◆" : state === "submitted" ? "◇" : "■"
      lines.push(`${icon}  ${options.message}`)

      if (state === "active") {
        lines.push(options.multiple
          ? "│  ↑/↓ move · Space toggle · Enter confirm · Esc cancel"
          : "│  ↑/↓ move · Enter confirm · Esc cancel")
        lines.push("│")
        options.items.forEach((item, index) => {
          const focused = index === cursor
          const checked = options.multiple ? selected.has(item.value) : focused
          const marker = checked ? "●" : "○"
          const prefix = focused ? "❯" : " "
          const hint = item.hint ? `  ${item.hint}` : ""
          lines.push(`│ ${prefix} ${marker} ${item.label}${hint}`)
        })
        if (validationError) lines.push("│  Select at least one provider before continuing")
        lines.push("└")
      } else if (state === "submitted") {
        const values = options.multiple
          ? options.items.filter((item) => selected.has(item.value))
          : [options.items[cursor]!]
        lines.push(`│  ${values.map((item) => item.label).join(", ")}`)
      } else {
        lines.push("│  Cancelled")
      }

      const clear = renderedLines > 0 ? `\u001B[${renderedLines}A\u001B[J` : ""
      options.output.write(`${clear}${lines.join("\n")}\n`)
      renderedLines = lines.length
    }

    const cleanup = (): void => {
      options.input.removeListener("keypress", onKeypress)
      options.input.removeListener("end", onEnd)
      if (options.input.isTTY && options.input.setRawMode) options.input.setRawMode(wasRaw)
      if (!wasFlowing) options.input.pause()
    }

    const submit = (): void => {
      if (options.multiple && options.required && selected.size === 0) {
        validationError = true
        render()
        return
      }
      render("submitted")
      cleanup()
      resolve(options.multiple
        ? options.items.filter((item) => selected.has(item.value)).map((item) => item.value)
        : [options.items[cursor]!.value])
    }

    const cancel = (): void => {
      render("cancelled")
      cleanup()
      reject(new SetupCancelledError())
    }

    const onEnd = (): void => {
      cleanup()
      reject(new SetupCancelledError())
    }

    const onKeypress = (_input: string, key: Key): void => {
      if (key.name === "up" || key.name === "k") {
        cursor = (cursor - 1 + options.items.length) % options.items.length
        validationError = false
        render()
        return
      }
      if (key.name === "down" || key.name === "j") {
        cursor = (cursor + 1) % options.items.length
        validationError = false
        render()
        return
      }
      if (key.name === "space") {
        if (options.multiple) {
          const value = options.items[cursor]!.value
          if (selected.has(value)) selected.delete(value)
          else selected.add(value)
        }
        validationError = false
        render()
        return
      }
      if (key.name === "return" || key.name === "enter") {
        submit()
        return
      }
      if (key.name === "escape" || (key.ctrl && key.name === "c")) cancel()
    }

    options.input.on("keypress", onKeypress)
    options.input.once("end", onEnd)
    render()
  })
}
