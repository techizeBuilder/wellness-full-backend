export const USER_TYPES = {
  USER: 'user',
  EXPERT: 'expert',
  ADMIN: 'admin'
} as const;

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];
