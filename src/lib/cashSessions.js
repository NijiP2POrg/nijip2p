export const VENUE_TAG = "[venue-pin]";
export const venuePinMessage = (pin, region, opts = {}) => VENUE_TAG + JSON.stringify({
  v: 1,
  kind: pin.kind,
  cell: String(pin.cell),
  words: pin.words ?? null,
  ...(opts.includeCode === false ? {} : {
    code: String(pin.code)
  }),
  ...(region?.city ? {
    city: region.city
  } : {}),
  ...(region?.state ? {
    state: region.state
  } : {})
});
export const parseVenuePin = text => {
  try {
    if (!text || !text.startsWith(VENUE_TAG)) return null;
    const p = JSON.parse(text.slice(VENUE_TAG.length));
    if (p?.cell == null) return null;
    return p;
  } catch {
    return null;
  }
};