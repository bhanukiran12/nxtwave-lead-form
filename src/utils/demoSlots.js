import { DEMO_SLOT_CUTOFF_MINUTES } from '../constants/formConstants';

const SLOT_TIMES = [
  { hour: 11, minute: 0 },
  { hour: 18, minute: 0 }
];

const pad2 = (num) => String(num).padStart(2, '0');

export const formatDateYMD = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const formatDateTimeYMDHMS = (date) =>
  `${formatDateYMD(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

function formatDisplayTime(date) {
  const hours = date.getHours();
  const hour12 = hours % 12 || 12;
  const meridian = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${pad2(date.getMinutes())}${meridian}`;
}

function formatTimeRange(slotStart) {
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
  const startHour12 = slotStart.getHours() % 12 || 12;
  const endHour12 = slotEnd.getHours() % 12 || 12;
  const startMeridian = slotStart.getHours() >= 12 ? 'PM' : 'AM';
  const endMeridian = slotEnd.getHours() >= 12 ? 'PM' : 'AM';
  return `${startHour12}${startMeridian} - ${endHour12}${endMeridian}`;
}

function formatDayLabel(slotDate, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
  const diffDays = Math.round((target - today) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';

  return target.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });
}

export function getDemoSlotDetails(slotStart, now = new Date()) {
  if (!(slotStart instanceof Date) || Number.isNaN(slotStart.getTime())) {
    return { label: '', slotDate: '', slotDateTime: '', timeSlot: '' };
  }

  return {
    label: `${formatDayLabel(slotStart, now)} - ${formatDisplayTime(slotStart)}`,
    slotDate: formatDateYMD(slotStart),
    slotDateTime: formatDateTimeYMDHMS(slotStart),
    timeSlot: formatTimeRange(slotStart)
  };
}

export function buildDemoSlotOptions(now = new Date(), count = 4) {
  const slots = [];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let dayOffset = 0; dayOffset <= 1 && slots.length < count; dayOffset += 1) {
    const cursor = new Date(startOfToday);
    cursor.setDate(cursor.getDate() + dayOffset);

    SLOT_TIMES.forEach(({ hour, minute }) => {
      if (slots.length >= count) return;

      const slotStart = new Date(cursor);
      slotStart.setHours(hour, minute, 0, 0);
      const bookingCutoff = new Date(slotStart.getTime() - DEMO_SLOT_CUTOFF_MINUTES * 60 * 1000);

      if (now < bookingCutoff) {
        const details = getDemoSlotDetails(slotStart, now);
        slots.push({
          value: details.slotDateTime,
          ...details
        });
      }
    });
  }

  return slots;
}

function parseLegacyDemoLabel(demoValue) {
  const parts = String(demoValue || '').split(' - ');
  if (parts.length !== 2) return null;

  const dayLabel = (parts[0] || '').trim().toLowerCase();
  const timeRaw = (parts[1] || '').trim().toUpperCase();
  const timeMatch = timeRaw.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!timeMatch) return null;

  const now = new Date();
  const slotDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dayLabel === 'tomorrow') {
    slotDateObj.setDate(slotDateObj.getDate() + 1);
  } else if (dayLabel !== 'today') {
    const parsed = new Date(`${parts[0]} ${now.getFullYear()} ${timeRaw}`);
    if (Number.isNaN(parsed.getTime())) return null;
    return getDemoSlotDetails(parsed, now);
  }

  let hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const meridian = timeMatch[3];

  if (meridian === 'PM' && hour !== 12) hour += 12;
  if (meridian === 'AM' && hour === 12) hour = 0;

  slotDateObj.setHours(hour, minute, 0, 0);
  return getDemoSlotDetails(slotDateObj, now);
}

export function parseDemoSlotValue(demoValue) {
  if (!demoValue) return { label: '', slotDate: '', slotDateTime: '', timeSlot: '' };

  const parsedDate = new Date(String(demoValue).replace(' ', 'T'));
  if (!Number.isNaN(parsedDate.getTime())) {
    return getDemoSlotDetails(parsedDate);
  }

  return parseLegacyDemoLabel(demoValue) || { label: '', slotDate: '', slotDateTime: '', timeSlot: '' };
}
