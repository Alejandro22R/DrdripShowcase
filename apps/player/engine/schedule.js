// Slide scheduling in clinic time (America/Puerto_Rico, UTC-4 all year).
// Plain ES2015 without modules so it runs on older Smart TV browsers.
(function (root) {
  'use strict';
  var V = (root.Vitrina = root.Vitrina || {});

  var CLINIC_OFFSET_MIN = -240;

  /** Clinic-local weekday (0 = Sunday), minutes since midnight and date. */
  V.clinicTime = function (date) {
    var shifted = new Date((date || new Date()).getTime() + CLINIC_OFFSET_MIN * 60000);
    return {
      day: shifted.getUTCDay(),
      minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
      hours: shifted.getUTCHours(),
      mins: shifted.getUTCMinutes(),
      date: shifted.getUTCDate(),
      month: shifted.getUTCMonth(),
    };
  };

  function toMinutes(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(text || '');
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }

  function inRange(minutes, from, to) {
    if (from === null && to === null) return true;
    if (from === null) return minutes < to;
    if (to === null) return minutes >= from;
    if (from === to) return true;
    // A range such as 20:00–06:00 wraps past midnight.
    return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
  }

  V.isClinicOpen = function (clinicHours, time) {
    var range = clinicHours ? clinicHours[String(time.day)] : null;
    if (!range) return false;
    var from = toMinutes(range[0]);
    var to = toMinutes(range[1]);
    return from !== null && to !== null && time.minutes >= from && time.minutes < to;
  };

  V.isSlideActive = function (schedule, clinicHours, date) {
    if (!schedule) return true;
    var time = V.clinicTime(date);
    if (schedule.days && schedule.days.length && schedule.days.indexOf(time.day) === -1) return false;
    if (!inRange(time.minutes, toMinutes(schedule.from), toMinutes(schedule.to))) return false;
    if (schedule.clinic === 'open') return V.isClinicOpen(clinicHours, time);
    if (schedule.clinic === 'closed') return !V.isClinicOpen(clinicHours, time);
    return true;
  };

  V.activeSlides = function (slides, clinicHours, date) {
    return (slides || []).filter(function (slide) {
      return V.isSlideActive(slide.schedule, clinicHours, date);
    });
  };

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  /** "9:05 a. m." and "martes 12 de noviembre" in clinic time. */
  V.formatClock = function (date) {
    var t = V.clinicTime(date);
    var h12 = t.hours % 12 === 0 ? 12 : t.hours % 12;
    return {
      time: h12 + ':' + (t.mins < 10 ? '0' : '') + t.mins,
      suffix: t.hours < 12 ? 'a. m.' : 'p. m.',
      date: DAYS[t.day] + ' ' + t.date + ' de ' + MONTHS[t.month],
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
