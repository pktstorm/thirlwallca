/**
 * Curated historical milestones keyed by year.
 * Used to provide "In the world..." context on person profiles.
 */

interface HistoricalEvent {
  year: number
  event: string
  region?: string // optional region relevance
}

const MILESTONES: HistoricalEvent[] = [
  // Pre-1700
  { year: 1600, event: "The East India Company was founded" },
  { year: 1620, event: "The Mayflower sailed to Plymouth" },
  { year: 1666, event: "The Great Fire of London" },
  // 1700s
  { year: 1707, event: "The Acts of Union joined England and Scotland" },
  { year: 1756, event: "The Seven Years' War began" },
  { year: 1776, event: "American Declaration of Independence" },
  { year: 1789, event: "The French Revolution began" },
  // 1800s
  { year: 1801, event: "The United Kingdom was formed" },
  { year: 1812, event: "The War of 1812 between Britain and the US" },
  { year: 1815, event: "Napoleon defeated at Waterloo" },
  { year: 1825, event: "The first public railway opened in England" },
  { year: 1837, event: "Queen Victoria ascended the throne" },
  { year: 1845, event: "The Irish Potato Famine began" },
  { year: 1848, event: "The California Gold Rush began" },
  { year: 1851, event: "The Great Exhibition in London" },
  { year: 1861, event: "The American Civil War began" },
  { year: 1867, event: "Canadian Confederation" },
  { year: 1869, event: "The Suez Canal opened" },
  { year: 1876, event: "Alexander Graham Bell patented the telephone" },
  { year: 1885, event: "The Canadian Pacific Railway was completed" },
  { year: 1889, event: "The Eiffel Tower was built" },
  { year: 1896, event: "The first modern Olympic Games" },
  { year: 1899, event: "The Boer War began" },
  // 1900s
  { year: 1901, event: "Queen Victoria died; Edward VII became King" },
  { year: 1903, event: "The Wright Brothers' first flight" },
  { year: 1906, event: "The San Francisco earthquake" },
  { year: 1910, event: "George V became King" },
  { year: 1912, event: "The Titanic sank" },
  { year: 1914, event: "World War I began" },
  { year: 1918, event: "World War I ended; Spanish Flu pandemic" },
  { year: 1920, event: "Women gained the right to vote in the US" },
  { year: 1922, event: "The BBC was founded" },
  { year: 1926, event: "The General Strike in Britain" },
  { year: 1929, event: "The Wall Street Crash and Great Depression" },
  { year: 1936, event: "Edward VIII abdicated; George VI became King" },
  { year: 1939, event: "World War II began" },
  { year: 1941, event: "Pearl Harbor; US entered WWII" },
  { year: 1945, event: "World War II ended" },
  { year: 1947, event: "India gained independence" },
  { year: 1948, event: "The NHS was founded in Britain" },
  { year: 1949, event: "Newfoundland joined Canadian Confederation" },
  { year: 1952, event: "Elizabeth II became Queen" },
  { year: 1953, event: "Everest was first summited" },
  { year: 1957, event: "Sputnik launched the Space Age" },
  { year: 1961, event: "Yuri Gagarin became the first human in space" },
  { year: 1963, event: "President Kennedy was assassinated" },
  { year: 1967, event: "Canada's Centennial celebrations" },
  { year: 1969, event: "The Moon landing" },
  { year: 1972, event: "The Summit Series: Canada vs USSR hockey" },
  { year: 1976, event: "Montreal hosted the Summer Olympics" },
  { year: 1981, event: "The IBM PC was released" },
  { year: 1982, event: "The Falklands War; Canada's Constitution repatriated" },
  { year: 1989, event: "The Berlin Wall fell" },
  { year: 1990, event: "The World Wide Web was invented" },
  { year: 1991, event: "The Soviet Union dissolved" },
  { year: 1997, event: "Princess Diana died; Hong Kong returned to China" },
  { year: 1999, event: "The Y2K scare" },
  // 2000s
  { year: 2001, event: "The September 11 attacks" },
  { year: 2003, event: "The Iraq War began" },
  { year: 2007, event: "The iPhone was released" },
  { year: 2008, event: "The Global Financial Crisis" },
  { year: 2010, event: "Vancouver hosted the Winter Olympics" },
  { year: 2012, event: "London hosted the Summer Olympics" },
  { year: 2016, event: "Brexit referendum" },
  { year: 2020, event: "The COVID-19 pandemic began" },
  { year: 2022, event: "Queen Elizabeth II died; Charles III became King" },
]

/**
 * Find the closest historical event to a given year.
 */
export function getHistoricalContext(year: number): string | null {
  if (!year || year < 1600) return null

  // Find the closest event
  let closest: HistoricalEvent | null = null
  let minDiff = Infinity

  for (const event of MILESTONES) {
    const diff = Math.abs(event.year - year)
    if (diff < minDiff) {
      minDiff = diff
      closest = event
    }
  }

  if (!closest || minDiff > 10) return null

  if (closest.year === year) {
    return `The same year ${closest.event.toLowerCase()}.`
  } else if (closest.year < year) {
    const diff = year - closest.year
    return `${diff} year${diff > 1 ? "s" : ""} after ${closest.event.toLowerCase()}.`
  } else {
    const diff = closest.year - year
    return `${diff} year${diff > 1 ? "s" : ""} before ${closest.event.toLowerCase()}.`
  }
}

/**
 * Get the monarch/head of state for a given year (British/Canadian focus).
 */
export function getMonarch(year: number): string | null {
  if (year < 1660) return null
  if (year <= 1685) return "Charles II"
  if (year <= 1688) return "James II"
  if (year <= 1694) return "William III & Mary II"
  if (year <= 1702) return "William III"
  if (year <= 1714) return "Queen Anne"
  if (year <= 1727) return "George I"
  if (year <= 1760) return "George II"
  if (year <= 1820) return "George III"
  if (year <= 1830) return "George IV"
  if (year <= 1837) return "William IV"
  if (year <= 1901) return "Queen Victoria"
  if (year <= 1910) return "Edward VII"
  if (year <= 1936) return "George V"
  if (year <= 1936) return "Edward VIII"
  if (year <= 1952) return "George VI"
  if (year <= 2022) return "Elizabeth II"
  return "Charles III"
}

/**
 * Generate a full historical context blurb for a birth year.
 */
export function generateBirthContext(year: number, _place?: string | null): string | null {
  if (!year || year < 1600) return null

  const parts: string[] = []

  const monarch = getMonarch(year)
  if (monarch) {
    parts.push(`During the reign of ${monarch}`)
  }

  const context = getHistoricalContext(year)
  if (context) {
    parts.push(context)
  }

  if (parts.length === 0) return null
  return parts.join(". ")
}
