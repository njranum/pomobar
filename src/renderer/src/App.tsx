import { useEffect } from 'react'

export default function App(): React.JSX.Element {
  useEffect(() => {
    window.api.ping().then((response) => {
      console.log('[renderer] received: ', response)
    })
  }, [])

  return (
    <>
      <div className="p-4">
        <p>pomobar</p>
      </div>
    </>
  )
}
