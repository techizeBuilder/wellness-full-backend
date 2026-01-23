import User from '../models/User';
import Expert from '../models/Expert';

export const checkEmailExists = async (email: string, excludeCollection: 'user' | 'expert' | null = null, excludeId: string | null = null) => {
  try {
    let userExists = false;
    let expertExists = false;

    if (excludeCollection !== 'user') {
      const existingUser = await (User as any).findOne({ email });
      if (existingUser && (!excludeId || existingUser._id.toString() !== excludeId)) {
        userExists = true;
      }
    }

    if (excludeCollection !== 'expert') {
      const existingExpert = await (Expert as any).findOne({ email });
      if (existingExpert && (!excludeId || existingExpert._id.toString() !== excludeId)) {
        expertExists = true;
      }
    }

    if (userExists && expertExists) {
      return { exists: true, collection: 'both', message: 'This email is already registered in the system' };
    } else if (userExists) {
      return { exists: true, collection: 'user', message: 'This email is already registered as a user account' };
    } else if (expertExists) {
      return { exists: true, collection: 'expert', message: 'This email is already registered as an expert account' };
    }

    return { exists: false, collection: null, message: null };
  } catch (error) {
    console.error('Error checking email existence:', error);
    throw new Error('Error validating email');
  }
};

export const checkPhoneExists = async (phone: string, excludeCollection: 'user' | 'expert' | null = null, excludeId: string | null = null) => {
  try {
    // Normalize phone number (remove non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');
    
    let userExists = false;
    let expertExists = false;

    if (excludeCollection !== 'user') {
      const existingUser = await (User as any).findOne({ phone: normalizedPhone });
      if (existingUser && (!excludeId || existingUser._id.toString() !== excludeId)) {
        userExists = true;
      }
    }

    if (excludeCollection !== 'expert') {
      const existingExpert = await (Expert as any).findOne({ phone: normalizedPhone });
      if (existingExpert && (!excludeId || existingExpert._id.toString() !== excludeId)) {
        expertExists = true;
      }
    }

    if (userExists && expertExists) {
      return { exists: true, collection: 'both', message: 'This phone number is already registered in the system' };
    } else if (userExists) {
      return { exists: true, collection: 'user', message: 'This phone number is already registered as a user account' };
    } else if (expertExists) {
      return { exists: true, collection: 'expert', message: 'This phone number is already registered as an expert account' };
    }

    return { exists: false, collection: null, message: null };
  } catch (error) {
    console.error('Error checking phone existence:', error);
    throw new Error('Error validating phone number');
  }
};

/**
 * Strict email validation for healthcare-grade data integrity
 * Rejects invalid patterns while accepting valid formats
 */
export const validateEmailStrict = (email: string): { isValid: boolean; error?: string } => {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic structure check
  if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  const [localPart, domainPart] = parts;

  // Reject emails starting with underscore
  if (localPart.startsWith('_')) {
    return { isValid: false, error: 'Email cannot start with an underscore' };
  }

  // Reject invalid local part patterns
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._+-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(localPart)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Reject multiple consecutive dots
  if (localPart.includes('..') || domainPart.includes('..')) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Reject domain with numbers in TLD (e.g., .c4m, .c0m)
  const domainParts = domainPart.split('.');
  if (domainParts.length < 2) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  const tld = domainParts[domainParts.length - 1];
  if (/\d/.test(tld)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Reject multiple TLD patterns (e.g., .com.com.com, .com.subdomain.com)
  if (domainParts.length > 2) {
    // Allow subdomains but reject multiple TLDs
    const lastTwo = domainParts.slice(-2);
    const validTLDs = ['com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'in', 'uk', 'au', 'ca', 'de', 'fr', 'jp', 'cn'];
    const secondLast = lastTwo[0].toLowerCase();
    const last = lastTwo[1].toLowerCase();
    
    // Reject patterns like domain.com.com or domain.com.subdomain
    if (validTLDs.includes(secondLast) && validTLDs.includes(last)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
  }

  // Final comprehensive regex check
  // Accept: user+tag@domain.com, user.name@domain.co.uk, etc.
  // Reject: _user@domain.com, user@domain.c4m, user@domain.com.com.com
  const strictEmailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._+-]*[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  
  if (!strictEmailRegex.test(trimmedEmail)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Additional check: ensure TLD is at least 2 characters and only letters
  const tldMatch = trimmedEmail.match(/\.([a-zA-Z]{2,})$/);
  if (!tldMatch || tldMatch[1].length < 2) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
};
