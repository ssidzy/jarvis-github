import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef, useImperativeHandle, ReactNode } from 'react';
import gsap from 'gsap';

interface CardSwapProps {
  width?: number;
  height?: number;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  autoRotate?: boolean;
  onCardClick?: (index: number) => void;
  skewAmount?: number;
  easing?: string;
  children: ReactNode;
}

interface CardSwapRef {
  next: () => void;
}

export const Card = forwardRef(({ customClass, ...rest }, ref) => (
  <div
    ref={ref}
    {...rest}
    className={`absolute top-1/2 left-1/2 rounded-xl border border-white bg-black [transform-style:preserve-3d] [will-change:transform] [backface-visibility:hidden] ${customClass ?? ''} ${rest.className ?? ''}`.trim()}
  />
));
Card.displayName = 'Card';

const makeSlot = (i: number, distX: number, distY: number, total: number) => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i
});

const placeNow = (el: any, slot: any, skew: number) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true
  });

const CardSwapInner = ({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  autoRotate = true,
  onCardClick,
  skewAmount = 6,
  easing = 'elastic',
  children,
  onSwapRef
}: CardSwapProps & { onSwapRef?: (fn: () => void) => void }) => {
  const config =
    easing === 'elastic'
      ? {
          ease: 'elastic.out(0.6,0.9)',
          durDrop: 2,
          durMove: 2,
          durReturn: 2,
          promoteOverlap: 0.9,
          returnDelay: 0.05
        }
      : easing === 'linear'
      ? {
          ease: 'linear',
          durDrop: 0.4,
          durMove: 0.4,
          durReturn: 0.4,
          promoteOverlap: 0.5,
          returnDelay: 0.2
        }
      : {
          ease: 'power1.inOut',
          durDrop: 0.8,
          durMove: 0.8,
          durReturn: 0.8,
          promoteOverlap: 0.45,
          returnDelay: 0.2
        };

  const childArr = useMemo(() => Children.toArray(children), [children]);
  const refs = useMemo(
    () => childArr.map(() => React.createRef()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childArr.length]
  );

  const order = useRef(Array.from({ length: childArr.length }, (_, i) => i));

  const tlRef = useRef(null);
  const intervalRef = useRef();
  const container = useRef(null);

  useEffect(() => {
    const total = refs.length;
    refs.forEach((r, i) => placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount));

    const swap = () => {
      if (order.current.length < 2) return;

      const [front, ...rest] = order.current;
      const elFront = refs[front].current;
      const tl = gsap.timeline();
      tlRef.current = tl;

      tl.to(elFront, {
        y: '+=500',
        duration: config.durDrop,
        ease: config.ease
      });

      tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
      rest.forEach((idx, i) => {
        const el = refs[idx].current;
        const slot = makeSlot(i, cardDistance, verticalDistance, refs.length);
        tl.set(el, { zIndex: slot.zIndex }, 'promote');
        tl.to(
          el,
          {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            duration: config.durMove,
            ease: config.ease
          },
          `promote+=${i * 0.15}`
        );
      });

      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length);
      tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
      tl.call(
        () => {
          gsap.set(elFront, { zIndex: backSlot.zIndex });
        },
        undefined,
        'return'
      );
      tl.to(
        elFront,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          duration: config.durReturn,
          ease: config.ease
        },
        'return'
      );

      tl.call(() => {
        order.current = [...rest, front];
      });
    };

    // Only auto-rotate if enabled
    if (autoRotate) {
      swap();
      intervalRef.current = window.setInterval(swap, delay);
    }

    // Expose swap function to parent
    if (onSwapRef) {
      onSwapRef(swap);
    }

    if (pauseOnHover) {
      const node = container.current;
      const pause = () => {
        tlRef.current?.pause();
        clearInterval(intervalRef.current);
      };
      const resume = () => {
        tlRef.current?.play();
        intervalRef.current = window.setInterval(swap, delay);
      };
      node.addEventListener('mouseenter', pause);
      node.addEventListener('mouseleave', resume);
      return () => {
        node.removeEventListener('mouseenter', pause);
        node.removeEventListener('mouseleave', resume);
        clearInterval(intervalRef.current);
      };
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardDistance, verticalDistance, delay, pauseOnHover, autoRotate, skewAmount, easing]);

  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width, height, ...(child.props.style ?? {}) },
          onClick: e => {
            child.props.onClick?.(e);
            onCardClick?.(i);
          }
        })
      : child
  );

  return (
    <div
      ref={container}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 perspective-[900px] overflow-visible"
      style={{ width, height }}
    >
      {rendered}
    </div>
  );
};

const CardSwap = forwardRef<CardSwapRef, CardSwapProps>(({ width = 500, height = 400, cardDistance = 60, verticalDistance = 70, delay = 5000, pauseOnHover = false, autoRotate = true, onCardClick, skewAmount = 6, easing = 'elastic', children }, ref) => {
  const swapRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    next: () => {
      if (swapRef.current) {
        swapRef.current();
      }
    }
  }), []);

  return (
    <CardSwapInner
      width={width}
      height={height}
      cardDistance={cardDistance}
      verticalDistance={verticalDistance}
      delay={delay}
      pauseOnHover={pauseOnHover}
      autoRotate={autoRotate}
      onCardClick={onCardClick}
      skewAmount={skewAmount}
      easing={easing}
      children={children}
      onSwapRef={(fn) => {
        swapRef.current = fn;
      }}
    />
  );
});
CardSwap.displayName = 'CardSwap';

export default CardSwap;
