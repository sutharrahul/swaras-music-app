// extract primary email
const extractPrimaryEmail = (userData: any): string => {
  if (userData.email_addresses && userData.email_addresses.length > 0) {
    // Find primary email or use first one
    const primaryEmail = userData.email_addresses.find(
      (email: any) => email.id === userData.primary_email_address_id
    );

    if (primaryEmail) {
      return primaryEmail.email_address;
    }

    // Fallback to first email
    return userData.email_addresses[0].email_address;
  }
  throw new Error('No email addresses found for user');
};

// Check if primary email is verified
const isEmailVerified = (userData: any): boolean => {
  if (userData.email_addresses && userData.email_addresses.length > 0) {
    const primaryEmail = userData.email_addresses.find(
      (email: any) => email.id === userData.primary_email_address_id
    );

    return primaryEmail ? primaryEmail.verification?.status === 'verified' : false;
  }

  return false;
};

// getOauthProvider
const getOauthProvider = (externalAccounts: any[]): string | null => {
  if (!externalAccounts || externalAccounts.length === 0) {
    return null;
  }

  // Get the provider from the first external account
  const provider = externalAccounts[0].provider;

  // Map common providers
  const providerMap: { [key: string]: string } = {
    oauth_google: 'google',
  };

  return providerMap[provider] || provider;
};

export { extractPrimaryEmail, isEmailVerified, getOauthProvider };
