import Header from '@/components/Header/Header';
import Hero from '@/components/Hero/Hero';
import Services from '@/components/Services/Services';
import About from '@/components/About/About';
import Results from '@/components/Results/Results';
import Contact from '@/components/Contact/Contact';
import Footer from '@/components/Footer/Footer';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Services />
      <About />
      <Results />
      <Contact />
      <Footer />
    </main>
  );
}
