import { GrainGradient } from '@paper-design/shaders-react';

/**
 * Coquille commune aux écrans d'authentification : dégradé animé plein écran
 * (palette GDA uniquement — blanc, orange, cuivre, brun ; pas de noir) et carte
 * formulaire posée dessus, à droite.
 */
export default function AuthCard({ title, subtitle, children }) {
    return (
        <div className="relative min-h-screen overflow-hidden bg-white">
            <GrainGradient
                speed={0.35}
                scale={1}
                rotation={0}
                offsetX={0}
                offsetY={0}
                softness={0.75}
                intensity={0.45}
                noise={0.12}
                shape="corners"
                colors={['#FFFFFF', '#FF6A3A', '#b26440', '#381419']}
                colorBack="#FFFFFF"
                className="absolute inset-0"
            />

            {/* Voile brun GDA sur la moitié gauche : le dégradé étant animé, le texte blanc
                pouvait tomber sur une zone claire et devenir illisible. Teinte de marque
                (#381419), pas du noir. */}
            <div
                className="pointer-events-none absolute inset-y-0 left-0 hidden w-[62%] lg:block"
                style={{
                    background:
                        'linear-gradient(to right, rgba(56,20,25,0.78) 0%, rgba(56,20,25,0.55) 45%, rgba(56,20,25,0) 100%)',
                }}
            />

            <div
                className="relative grid min-h-screen gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:items-center lg:gap-12 lg:px-14 xl:px-20"
                style={{
                    paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)',
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)',
                }}
            >
                {/* Colonne marque — masquée sur mobile, l'espace revient au formulaire. */}
                <div className="hidden min-w-0 lg:flex lg:flex-col lg:justify-center">
                    <img
                        src="/logo/gdamoney-mark.png"
                        alt="Gda Money"
                        className="h-14 w-auto self-start rounded-xl bg-white px-4 py-2.5 object-contain shadow-sm"
                    />

                    <h2 className="mt-10 max-w-xl text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] text-white xl:text-[52px]">
                        Pilotez vos campagnes
                        <br />
                        en temps réel.
                    </h2>
                    <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/80">
                        Ventes terrain, reporting téléphonique, performances et contrats — tout le suivi
                        commercial du Groupe GDA dans un seul espace.
                    </p>
                </div>

                {/* Carte formulaire — posée sur le dégradé. */}
                <div className="flex min-w-0 items-center justify-center lg:justify-end">
                    <div className="w-full max-w-[420px] rounded-2xl bg-white p-7 shadow-[0_20px_60px_-15px_rgba(56,20,25,0.35)] sm:p-9">
                        <img
                            src="/logo/gdamoney-mark.png"
                            alt="Gda Money"
                            className="mb-7 h-10 w-auto object-contain lg:hidden"
                        />

                        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-[30px]">
                            {title}
                        </h1>
                        {subtitle && <p className="mt-2 text-[15px] text-gray-500">{subtitle}</p>}

                        <div className="mt-7">{children}</div>

                        <p className="mt-7 border-t border-gray-100 pt-4 text-xs text-gray-400">
                            © {new Date().getFullYear()} Groupe GDA
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
