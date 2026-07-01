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
      const mm = gsap.matchMedia();
      const heroItems = gsap.utils.toArray<HTMLElement>('[data-motion-hero], [data-landing-hero]');
      const revealItems = gsap.utils.toArray<HTMLElement>('[data-motion-reveal], [data-landing-reveal]');
      const staggerGroups = gsap.utils.toArray<HTMLElement>('[data-motion-stagger], [data-landing-stagger]');
      const parallaxItems = gsap.utils.toArray<HTMLElement>('[data-motion-parallax], [data-landing-parallax]');
      const rules = gsap.utils.toArray<HTMLElement>('[data-motion-rule], [data-landing-rule]');
      const scrubItems = gsap.utils.toArray<HTMLElement>('[data-motion-scrub]');

      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          allowMotion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const { reduceMotion } = context.conditions as { reduceMotion?: boolean };

          if (reduceMotion) {
            gsap.set([...heroItems, ...revealItems, ...scrubItems], { clearProps: 'all' });
            gsap.set([...rules, ...parallaxItems], { clearProps: 'transform' });
            return;
          }

          if (heroItems.length) {
            gsap.from(heroItems, {
              y: 28,
              autoAlpha: 0,
              duration: 0.95,
              ease: 'power3.out',
              stagger: 0.1,
            });
          }

          revealItems.forEach((item, index) => {
            gsap.from(item, {
              y: 56,
              autoAlpha: 0,
              duration: 0.95,
              ease: 'power3.out',
              delay: index === 0 ? 0.08 : 0,
              scrollTrigger: {
                trigger: item,
                start: 'top 84%',
                once: true,
              },
            });
          });

          staggerGroups.forEach((group) => {
            const items = Array.from(group.querySelectorAll<HTMLElement>('[data-stagger-item]'));
            if (!items.length) {
              return;
            }

            gsap.from(items, {
              y: 36,
              autoAlpha: 0,
              duration: 0.8,
              ease: 'power2.out',
              stagger: 0.1,
              scrollTrigger: {
                trigger: group,
                start: 'top 82%',
                once: true,
              },
            });
          });

          rules.forEach((rule) => {
            gsap.fromTo(
              rule,
              { scaleX: 0, transformOrigin: 'left center' },
              {
                scaleX: 1,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: rule,
                  start: 'top 88%',
                  once: true,
                },
              },
            );
          });

          parallaxItems.forEach((item) => {
            const depth = Number(item.dataset.parallaxDepth ?? '56');

            gsap.fromTo(
              item,
              { yPercent: -depth * 0.14 },
              {
                yPercent: depth * 0.14,
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

          scrubItems.forEach((item) => {
            const offset = Number(item.dataset.motionY ?? '88');

            gsap.fromTo(
              item,
              {
                y: offset,
                autoAlpha: 0.24,
              },
              {
                y: -offset * 0.16,
                autoAlpha: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: item,
                  start: 'top 92%',
                  end: 'bottom 16%',
                  scrub: true,
                },
              },
            );
          });
        },
      );

      dispose = () => {
        mm.revert();
      };
    }, rootRef.value);

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
