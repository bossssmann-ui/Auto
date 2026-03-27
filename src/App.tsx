import Header from './components/Header'
import Hero from './components/Hero'
import AuctionTicker from './components/AuctionTicker'
import PainSolution from './components/PainSolution'
import Services from './components/Services'
import HeavyMachinery from './components/HeavyMachinery'
import ProductExcavator from './components/ProductExcavator'
import ProductCar from './components/ProductCar'
import Calculator from './components/Calculator'
import YouTubeGrid from './components/YouTubeGrid'
import Trust from './components/Trust'
import DeliveryMap from './components/DeliveryMap'
import LogisticsProof from './components/LogisticsProof'
import LeadMagnet from './components/LeadMagnet'
import Footer from './components/Footer'
import FloatingWidget from './components/FloatingWidget'
import ExitIntent from './components/ExitIntent'

function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <AuctionTicker />
        <PainSolution />
        <Services />
        <HeavyMachinery />
        <ProductExcavator />
        <ProductCar />
        <Calculator />
        <YouTubeGrid />
        <Trust />
        <DeliveryMap />
        <LogisticsProof />
        <LeadMagnet />
      </main>
      <Footer />
      <FloatingWidget />
      <ExitIntent />
    </div>
  )
}

export default App
