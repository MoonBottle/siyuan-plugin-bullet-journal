export function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateReminderTime(
  itemDate: string,
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  reminder: ReminderConfig,
): number {
  if (reminder.type === 'absolute') {
    var baseTime = new Date(`${itemDate}T${reminder.time || '00:00'}:00`).getTime()
    if (reminder.alertMode && reminder.alertMode.type === 'before' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    if (reminder.alertMode && reminder.alertMode.type === 'custom' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    return baseTime
  }
  var baseTime: number
  if (reminder.relativeTo === 'end') {
    baseTime = endDateTime
      ? new Date(endDateTime).getTime()
      : new Date(`${itemDate}T${endTime || '23:59'}:00`).getTime()
  } else {
    baseTime = startDateTime
      ? new Date(startDateTime).getTime()
      : new Date(`${itemDate}T${startTime || '00:00'}:00`).getTime()
  }
  return baseTime - (reminder.offsetMinutes || 0) * 60000
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const key in vars) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), vars[key])
  }
  return result
}
