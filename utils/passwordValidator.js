/**
 * Password Validator Utility
 * Validates password strength requirements
 */

class PasswordValidator {
  /**
   * Validate password strength
   * Requirements:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character (!@#$%^&*)
   */
  static validate(password) {
    const errors = [];

    if (!password) {
      return { valid: false, errors: ['Password is required'] };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get password strength score (0-5)
   */
  static getStrength(password) {
    if (!password) return 0;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

    return strength;
  }

  /**
   * Get strength description
   */
  static getStrengthDescription(score) {
    const descriptions = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong', 'Excellent'];
    return descriptions[Math.min(score, 5)];
  }
}

module.exports = PasswordValidator;
