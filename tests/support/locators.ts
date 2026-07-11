import type { Locator, Page } from "@playwright/test";

type LocatorCandidate =
  | { testId: string }
  | { label: string | RegExp }
  | { placeholder: string | RegExp }
  | { role: Parameters<Page["getByRole"]>[0]; name: string | RegExp };

export function firstVisible(page: Page, candidates: LocatorCandidate[]): Locator {
  const locators = candidates.map((candidate) => toLocator(page, candidate));
  return locators.reduce((combined, locator) => combined.or(locator));
}

function toLocator(page: Page, candidate: LocatorCandidate): Locator {
  if ("testId" in candidate) {
    return page.getByTestId(candidate.testId);
  }

  if ("label" in candidate) {
    return page.getByLabel(candidate.label);
  }

  if ("placeholder" in candidate) {
    return page.getByPlaceholder(candidate.placeholder);
  }

  return page.getByRole(candidate.role, { name: candidate.name });
}
