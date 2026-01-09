export function formatDateTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.log('Invalid date string:', dateString);
    return '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  // Convert to 12-hour format
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // convert 0 -> 12
  const formattedHours = String(hours).padStart(2, '0');

  // Format: dd/mm/yy, hh:mm AM/PM
  return `${day}/${month}/${year}, ${formattedHours}:${minutes} ${ampm}`;
}

export function millisecondsToHHMMSS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const paddedSeconds = String(seconds).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedHours = String(hours).padStart(2, '0');

  return `${paddedHours}h ${paddedMinutes}m ${paddedSeconds}s`;
}