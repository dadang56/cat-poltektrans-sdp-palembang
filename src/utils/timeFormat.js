// "10:28:00" -> "10:28" for display; anything else is returned unchanged
export function jam(value) {
    return typeof value === 'string'
        ? value.replace(/^(\d{1,2}:\d{2}):\d{2}(\.\d+)?$/, '$1')
        : value
}
