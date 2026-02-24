function isValidDomain(domain) {
  const trimmed = (domain || "").trim().toLowerCase();
  const regex = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
  return regex.test(trimmed);
}

function normalizeDomain(input) {
  const raw = (input || "").trim();
  if (!raw) {
    return null;
  }

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsedUrl = new URL(candidate);
    let hostname = parsedUrl.hostname.toLowerCase();
    hostname = hostname.replace(/^www\./, "");
    if (!isValidDomain(hostname)) {
      return null;
    }
    return hostname;
  } catch (_error) {
    return null;
  }
}

function toBlockVariants(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return [];
  }
  return Array.from(new Set([normalized, `www.${normalized}`]));
}

module.exports = {
  isValidDomain,
  normalizeDomain,
  toBlockVariants,
};
