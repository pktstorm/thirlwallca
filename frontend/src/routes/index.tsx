import { createFileRoute, redirect } from "@tanstack/react-router"
import { fetchAuthSession } from "aws-amplify/auth"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    try {
      const session = await fetchAuthSession()
      if (session.tokens) {
        throw redirect({ to: "/tree" })
      }
    } catch (e: any) {
      if (e.to === "/tree") throw e
    }
    throw redirect({ to: "/login" })
  },
})
