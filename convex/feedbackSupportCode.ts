const SUPPORT_CODE_LENGTH = 12;

export const createFeedbackSupportCode = (appUserId: string) => {
  const normalizedId = appUserId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `QL-${normalizedId.slice(-SUPPORT_CODE_LENGTH)}`;
};
