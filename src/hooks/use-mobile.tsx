
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Set initial value
    handleResize()
    
    // Add event listener
    window.addEventListener("resize", handleResize)
    
    // Cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return isMobile
}
