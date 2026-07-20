export default function OrganizadorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="ctx-organizador min-h-screen bg-backdrop text-foreground">
      {children}
    </div>
  )
}
