/**
 * Feature Flags & Module Toggles for LifeOS
 * Default: Mental Health is ON (true), Digital Wellbeing is ON (true)
 */

const MENTAL_HEALTH_KEY = 'lifeos_mental_health_enabled';
const DIGITAL_WELLBEING_KEY = 'lifeos_digital_wellbeing_enabled';

/**
 * Check whether Mental Health & Cognitive Load management is enabled.
 * Default: FALSE (Tạm thời vô hiệu hóa / Tạm closed theo yêu cầu)
 */
export function isMentalHealthEnabled(): boolean {
  try {
    const val = localStorage.getItem(MENTAL_HEALTH_KEY);
    // If not explicitly set to 'true', default is closed (false)
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Set Mental Health management enabled/disabled and broadcast update event.
 */
export function setMentalHealthEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(MENTAL_HEALTH_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('lifeos_mental_health_updated', { detail: { enabled } }));
    window.dispatchEvent(new CustomEvent('lifeos_feature_toggle_updated', { detail: { feature: 'mental_health', enabled } }));
  } catch (err) {
    console.error('Failed to save mental health setting:', err);
  }
}

/**
 * Check whether Digital Wellbeing & Screentime balance is enabled.
 * Default: TRUE (BẬT)
 */
export function isDigitalWellbeingEnabled(): boolean {
  try {
    const val = localStorage.getItem(DIGITAL_WELLBEING_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Set Digital Wellbeing management enabled/disabled and broadcast update event.
 */
export function setDigitalWellbeingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DIGITAL_WELLBEING_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('lifeos_digital_wellbeing_updated', { detail: { enabled } }));
    window.dispatchEvent(new CustomEvent('lifeos_feature_toggle_updated', { detail: { feature: 'digital_wellbeing', enabled } }));
  } catch (err) {
    console.error('Failed to save digital wellbeing setting:', err);
  }
}

const SHOW_RANK_ON_TOPBAR_KEY = 'lifeos_show_rank_on_topbar';

/**
 * Check whether the Rank Badge is displayed on the Topbar.
 * Default: TRUE (BẬT khi Chế độ Cày Cuốc bật)
 */
export function isRankOnTopbarEnabled(): boolean {
  try {
    const val = localStorage.getItem(SHOW_RANK_ON_TOPBAR_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Set Topbar Rank display enabled/disabled and broadcast update event.
 */
export function setRankOnTopbarEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SHOW_RANK_ON_TOPBAR_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('lifeos_show_rank_on_topbar_updated', { detail: { enabled } }));
  } catch (err) {
    console.error('Failed to save rank on topbar setting:', err);
  }
}

