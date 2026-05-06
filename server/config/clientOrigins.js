const DEFAULT_CLIENT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

const splitOrigins = (value = "") =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const getAllowedClientOrigins = () => {
  const configuredOrigins = [
    process.env.CLIENT_URL,
    ...splitOrigins(process.env.CLIENT_URLS)
  ].filter(Boolean);

  return [...new Set([...configuredOrigins, ...DEFAULT_CLIENT_ORIGINS])];
};

const getPrimaryClientUrl = () => getAllowedClientOrigins()[0] || DEFAULT_CLIENT_ORIGINS[0];

module.exports = {
  getAllowedClientOrigins,
  getPrimaryClientUrl
};
