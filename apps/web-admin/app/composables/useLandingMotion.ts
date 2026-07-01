import { onBeforeUnmount, onMounted, type Ref } from 'vue';

export const useLandingMotion = (rootRef: Ref<HTMLElement | null>) => {
  let dispose: (() => void) | null = null;

  onMounted(async () => {
    if (!rootRef.value) {
      return;
    }

    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-landing-reveal]');
      const heroItems = gsap.utils.toArray<HTMLElement>('[data-landing-hero]');
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          allowMotion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const { reduceMotion } = context.conditions as { reduceMotion?: boolean };

          if (reduceMotion) {
            gsap.set([...heroItems, ...sections], { clearProps: 'all' });
            return;
          }

          gsap.from(heroItems, {
            y: 28,
            autoAlpha: 0,
            duration: 0.88,
            ease: 'power3.out',
            stagger: 0.1,
          });

          sections.forEach((section, index) => {
            gsap.from(section, {
              y: 56,
              autoAlpha: 0,
              duration: 0.86,
              ease: 'power3.out',
              delay: index === 0 ? 0.08 : 0,
              scrollTrigger: {
                trigger: section,
                start: 'top 78%',
                once: true,
              },
            });
          });

          return () => {
            ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
          };
        },
      );

      dispose = () => {
        mm.revert();
      };
    }, rootRef);

    const previousDispose = dispose;
    dispose = () => {
      previousDispose?.();
      ctx.revert();
    };
  });

  onBeforeUnmount(() => {
    dispose?.();
    dispose = null;
  });
};
