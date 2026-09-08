'use client';

import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { Children, cloneElement, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import './Dock.css';

const MotionLink = motion.create(Link);

function DockItem({
  children,
  className = '',
  onClick,
  href,
  current,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
  label,
}) {
  const ref = useRef(null);
  const isHovered = useMotionValue(0);
  const [hovered, setHovered] = useState(false);

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      width: baseItemSize,
    };
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
  );
  const size = useSpring(targetSize, spring);

  return (
    <MotionLink
      ref={ref}
      style={{
        width: size,
        height: size,
      }}
      onHoverStart={() => {
        isHovered.set(1);
        setHovered(true);
      }}
      onHoverEnd={() => {
        isHovered.set(0);
        setHovered(false);
      }}
      onFocus={() => {
        isHovered.set(1);
        setHovered(true);
      }}
      onBlur={() => {
        isHovered.set(0);
        setHovered(false);
      }}
      onClick={onClick}
      className={`dock-item ${className} ${current ? 'dock-item-active' : ''}`}
      href={href}
      aria-current={current ? 'page' : undefined}
      aria-label={label}
    >
      {Children.map(children, (child) => cloneElement(child, { isHovered }))}
      <AnimatePresence>
        {hovered && (
          <motion.span
            className="dock-tooltip"
            initial={{ opacity: 0, y: 6, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 4, x: '-50%' }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {current && <span className="dock-active-dot" aria-hidden="true" />}
    </MotionLink>
  );
}

function DockIcon({ children, className = '' }) {
  return <div className={`dock-icon ${className}`}>{children}</div>;
}

export default function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 160, damping: 14 },
  magnification = 64,
  distance = 140,
  panelHeight = 60,
  dockHeight = 90,
  baseItemSize = 46,
}) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxHeight = useMemo(
    () => Math.max(dockHeight, magnification + 16),
    [magnification, dockHeight],
  );
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div style={{ height, scrollbarWidth: 'none' }} className="dock-outer">
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={`dock-panel ${className}`}
        style={{ height: panelHeight }}
        role="navigation"
        aria-label="Application dock"
      >
        {items.map((item, index) => (
          <DockItem
            key={index}
            onClick={item.onClick}
            href={item.href}
            current={item.current}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            label={item.label}
          >
            <DockIcon>{item.icon}</DockIcon>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  );
}
