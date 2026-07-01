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
      const staggerGroups = gsap.utils.toArray<HTMLElement>('[data-landing-stagger]');
      const parallaxItems = gsap.utils.toArray<HTMLElement>('[data-landing-parallax]');
      const rules = gsap.utils.toArray<HTMLElement>('[data-landing-rule]');
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

          // Hero content settles in on load.
          gsap.from(heroItems, {
            y: 30,
            autoAlpha: 0,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.12,
          });

          // Whole sections fade up as they enter the viewport.
          sections.forEach((section, index) => {
            gsap.from(section, {
              y: 60,
              autoAlpha: 0,
              duration: 0.9,
              ease: 'power3.out',
              delay: index === 0 ? 0.1 : 0,
              scrollTrigger: {
                trigger: section,
                start: 'top 80%',
                once: true,
              },
            });
          });

          // Cards inside a group cascade in one after another.
          staggerGroups.forEach((group) => {
            const items = gsap.utils.toArray<HTMLElement>(':scope > [data-stagger-item]', group);
            if (!items.length) {
              return;
            }
            gsap.from(items, {
              y: 40,
              autoAlpha: 0,
              duration: 0.72,
              ease: 'power2.out',
              stagger: 0.12,
              scrollTrigger: {
                trigger: group,
                start: 'top 82%',
                once: true,
              },
            });
          });

          // Gold hairlines draw themselves across as they appear.
          rules.forEach((rule) => {
            gsap.fromTo(
              rule,
              { scaleX: 0, transformOrigin: 'left center' },
              {
                scaleX: 1,
                duration: 1.1,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: rule,
                  start: 'top 88%',
                  once: true,
                },
              },
            );
          });

          // Depth: decorative panels drift as the page scrolls.
          parallaxItems.forEach((item) => {
            const depth = Number(item.dataset.parallaxDepth ?? '60');
            gsap.fromTo(
              item,
              { yPercent: -depth * 0.12 },
              {
                yPercent: depth * 0.12,
                ease: 'none',
                scrollTrigger: {
                  trigger: item,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              },
            );
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
