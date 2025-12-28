export function rankFromStars(totalStars) {
  if (totalStars >= 1000) return "Lion Council";
  if (totalStars >= 600) return "Pillar";
  if (totalStars >= 300) return "Builder";
  if (totalStars >= 100) return "Contributor";
  return "Initiate";
}
