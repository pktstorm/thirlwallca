import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { OrbitalCanvas } from "./OrbitalCanvas"
import type { ReactNode } from "react"

// Mock the data hook to inject deterministic data without hitting an API.
vi.mock("../../hooks/usePersonOrbit", () => {
  return {
    usePersonOrbit: () => ({
      data: {
        focus: { id: "f", givenName: "Focus", surname: "Person", birthYear: 1980, deathYear: null, isLiving: true, photoUrl: null, sex: "male" },
        ancestorsByGeneration: [
          [
            { id: "dad", givenName: "Dad", surname: "Person", birthYear: 1950, deathYear: null, isLiving: true, photoUrl: null, sex: "male", parentSlot: "father", parentId: "f" },
            { id: "mom", givenName: "Mom", surname: "Person", birthYear: 1955, deathYear: null, isLiving: true, photoUrl: null, sex: "female", parentSlot: "mother", parentId: "f" },
          ],
        ],
        descendants: [],
        siblings: [],
        spouses: [],
      },
      isLoading: false,
      error: null,
    }),
    buildControlOptions: (a: any, b: any) => ({ ...a, ...b }),
  }
})

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("OrbitalCanvas", () => {
  it("renders focus and 2 ancestors", () => {
    renderWithQuery(<OrbitalCanvas focusPersonId="f" />)
    expect(screen.getByText("Focus Person")).toBeInTheDocument()
    expect(screen.getByText("Dad Person")).toBeInTheDocument()
    expect(screen.getByText("Mom Person")).toBeInTheDocument()
  })
})
