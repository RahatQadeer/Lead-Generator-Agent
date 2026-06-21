"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import {
  buildGeodesicWireframe,
  clampRotX,
  depthFromZ,
  fibonacciSphere,
  getSphereRadius,
  projectPoint,
  type SphereGraphSize,
} from "@/components/dashboard/sphere-graph-utils";

export interface SphereGraphNode {
  name: string;
  color: string;
  value: string;
  icon?: LucideIcon;
}

interface SphereUniverseGraphProps {
  nodes: SphereGraphNode[];
  size?: SphereGraphSize;
  theme?: "light" | "dark";
  center?: { value: string; label?: string };
  dragHint?: string;
  className?: string;
  ariaLabel?: string;
}

const SIZE_STYLES: Record<
  SphereGraphSize,
  {
    container: string;
    hint: string;
    label: string;
    value: string;
    iconBadge: string;
    iconSize: string;
    labelIcon: string;
  }
> = {
  sm: {
    container: "h-[168px] w-[200px]",
    hint: "text-[9px]",
    label: "text-[9px]",
    value: "text-[10px]",
    iconBadge: "h-6 w-6 rounded-lg",
    iconSize: "h-3 w-3",
    labelIcon: "h-2.5 w-2.5",
  },
  md: {
    container: "mx-auto h-[260px] w-full max-w-sm",
    hint: "text-[10px]",
    label: "text-[10px]",
    value: "text-[11px]",
    iconBadge: "h-7 w-7 rounded-lg",
    iconSize: "h-3.5 w-3.5",
    labelIcon: "h-3 w-3",
  },
  lg: {
    container: "mx-auto h-[min(400px,52vh)] w-full max-w-lg",
    hint: "text-xs",
    label: "text-[11px]",
    value: "text-xs",
    iconBadge: "h-8 w-8 rounded-xl",
    iconSize: "h-4 w-4",
    labelIcon: "h-3.5 w-3.5",
  },
  xl: {
    container: "mx-auto h-[min(720px,85vh)] w-full max-w-3xl",
    hint: "text-sm",
    label: "text-sm",
    value: "text-sm",
    iconBadge: "h-10 w-10 rounded-xl",
    iconSize: "h-[18px] w-[18px]",
    labelIcon: "h-4 w-4",
  },
};

const THEME_STYLES = {
  light: {
    hint: "text-gray-400",
    label: "text-gray-600",
    value: "text-gray-900",
    centerValue: "text-gray-950",
    centerLabel: "text-gray-400",
    centerRing: "bg-white/80 ring-gray-100",
    nodeLabel: "rgba(55,65,81,0.82)",
    nodeValue: "#111827",
  },
  dark: {
    hint: "text-gray-400",
    label: "text-gray-200",
    value: "text-white",
    centerValue: "text-white",
    centerLabel: "text-gray-300",
    centerRing: "bg-white/10 ring-white/15",
    nodeLabel: "rgba(229,231,235,0.92)",
    nodeValue: "rgba(255,255,255,0.95)",
  },
} as const;

export function SphereUniverseGraph({
  nodes,
  size = "sm",
  theme = "light",
  center,
  dragHint = "Drag to explore",
  className = "",
  ariaLabel = "Interactive data universe. Drag to explore.",
}: SphereUniverseGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wireGroupRef = useRef<SVGGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nodesRef = useRef(nodes);

  const rotation = useRef({ x: -12, y: 0 });
  const radiusRef = useRef(52);
  const boxSizeRef = useRef(184);
  const isVisible = useRef(true);
  const hoveredName = useRef<string | null>(null);

  const drag = useRef({
    active: false,
    pointerId: -1,
    sx: 0,
    sy: 0,
    rx: 0,
    ry: 0,
  });

  const pointer = useRef({ active: false, x: 0, y: 0 });

  nodesRef.current = nodes;

  const nodePositions = useMemo(
    () => fibonacciSphere(Math.max(nodes.length, 1)),
    [nodes.length]
  );
  const geodesic = useMemo(() => buildGeodesicWireframe(2), []);
  const styles = SIZE_STYLES[size];
  const colors = THEME_STYLES[theme];

  const applyLayoutSize = () => {
    const width =
      containerRef.current?.clientWidth ??
      (size === "xl" ? 720 : size === "lg" ? 400 : size === "md" ? 320 : 200);
    const radius = getSphereRadius(width, size);
    radiusRef.current = radius;
    boxSizeRef.current = radius * 2 + 48;

    const box = boxSizeRef.current;
    const globe = globeRef.current;
    const svg = svgRef.current;
    const glow = glowRef.current;

    if (globe) {
      globe.style.width = `${box}px`;
      globe.style.height = `${box}px`;
    }
    if (svg) {
      svg.setAttribute("width", String(box));
      svg.setAttribute("height", String(box));
      svg.setAttribute(
        "viewBox",
        `${-radius - 24} ${-radius - 24} ${box} ${box}`
      );
    }
    if (glow) {
      glow.style.width = `${radius * 2}px`;
      glow.style.height = `${radius * 2}px`;
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    applyLayoutSize();
    const observer = new ResizeObserver(applyLayoutSize);
    observer.observe(el);

    return () => observer.disconnect();
  }, [size]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const group = wireGroupRef.current;
    if (!group) return;

    group.replaceChildren();
    const lines = geodesic.edges.map(() => {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("stroke-linecap", "round");
      group.appendChild(line);
      return line;
    });

    return () => {
      lines.forEach((line) => line.remove());
    };
  }, [geodesic.edges]);

  useEffect(() => {
    let frame = 0;

    const animate = () => {
      if (isVisible.current && !drag.current.active) {
        rotation.current.y += 0.035;
      }

      rotation.current.x = clampRotX(rotation.current.x);

      const rotX = rotation.current.x;
      const rotY = rotation.current.y;
      const r = radiusRef.current;
      const dragging = drag.current.active;
      const currentNodes = nodesRef.current;

      const group = wireGroupRef.current;
      if (group) {
        const lines = group.querySelectorAll("line");
        geodesic.edges.forEach(([a, b], i) => {
          const line = lines[i];
          if (!line) return;

          const p1 = projectPoint(geodesic.verts[a], r, rotX, rotY);
          const p2 = projectPoint(geodesic.verts[b], r, rotX, rotY);

          line.setAttribute("x1", String(p1.x));
          line.setAttribute("y1", String(p1.y));
          line.setAttribute("x2", String(p2.x));
          line.setAttribute("y2", String(p2.y));

          const depth = depthFromZ((p1.z + p2.z) / 2, r);
          line.setAttribute(
            "stroke",
            `rgba(167,139,250,${0.1 + 0.45 * depth})`
          );
          line.setAttribute("stroke-width", String(0.4 + 0.7 * depth));
        });
      }

      const pointerActive = pointer.current.active && !dragging;
      let closestName: string | null = null;
      let closestDist = Infinity;
      const hitRadius = size === "xl" ? 52 : size === "md" ? 44 : 36;

      currentNodes.forEach((node, i) => {
        const el = nodeRefs.current[i];
        if (!el) return;

        const p = projectPoint(nodePositions[i], r, rotX, rotY);
        const depth = depthFromZ(p.z, r);
        const isHovered = !dragging && hoveredName.current === node.name;
        const scale = isHovered ? 1.18 : 0.7 + 0.38 * depth;

        el.style.transform = `translate3d(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px), 0) scale(${scale.toFixed(3)})`;
        el.style.opacity = String(0.28 + 0.72 * depth);
        el.style.zIndex = String(Math.round(depth * 1000));

        const dot = el.querySelector<HTMLElement>("[data-node-dot]");
        const badge = el.querySelector<HTMLElement>("[data-node-badge]");
        const label = el.querySelector<HTMLElement>("[data-node-label]");
        const labelIcon = el.querySelector<HTMLElement>("[data-node-label-icon]");
        const value = el.querySelector<HTMLElement>("[data-node-value]");
        const icon = el.querySelector<HTMLElement>("[data-node-icon]");

        const glowTarget = badge ?? dot;
        if (glowTarget) {
          glowTarget.style.boxShadow = isHovered
            ? `0 0 14px ${node.color}aa, 0 0 28px ${node.color}44`
            : `0 0 8px ${node.color}55`;
        }
        if (badge) {
          badge.style.borderColor = isHovered
            ? `${node.color}88`
            : "rgba(255,255,255,0.14)";
        }
        if (icon && isHovered) {
          icon.style.filter = `drop-shadow(0 0 6px ${node.color})`;
        } else if (icon) {
          icon.style.filter = "";
        }

        const textColor = isHovered ? node.color : colors.nodeLabel;
        if (label) label.style.color = textColor;
        if (labelIcon) {
          labelIcon.style.color = isHovered ? node.color : node.color;
          labelIcon.style.opacity = isHovered ? "1" : "0.9";
        }
        if (value) value.style.color = isHovered ? node.color : colors.nodeValue;

        if (pointerActive && depth > 0.42) {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const d = Math.hypot(pointer.current.x - cx, pointer.current.y - cy);
          if (d < closestDist && d < hitRadius) {
            closestDist = d;
            closestName = node.name;
          }
        }
      });

      hoveredName.current = pointerActive ? closestName : null;
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [geodesic, nodePositions, size, theme, colors.nodeLabel, colors.nodeValue]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag.current.active = true;
      drag.current.pointerId = e.pointerId;
      drag.current.sx = e.clientX;
      drag.current.sy = e.clientY;
      drag.current.rx = rotation.current.x;
      drag.current.ry = rotation.current.y;
      hoveredName.current = null;
      container.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (drag.current.active && e.pointerId === drag.current.pointerId) {
        const dx = e.clientX - drag.current.sx;
        const dy = e.clientY - drag.current.sy;
        rotation.current.y = drag.current.ry + dx * 0.35;
        rotation.current.x = clampRotX(drag.current.rx - dy * 0.35);
        return;
      }

      if (e.pointerType === "mouse") {
        pointer.current.active = true;
        pointer.current.x = e.clientX;
        pointer.current.y = e.clientY;
      }
    };

    const endDrag = (e: PointerEvent) => {
      if (!drag.current.active || e.pointerId !== drag.current.pointerId) return;
      drag.current.active = false;
      drag.current.pointerId = -1;
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !drag.current.active) {
        pointer.current.active = false;
        hoveredName.current = null;
      }
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
    container.addEventListener("pointerleave", onPointerLeave);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={`relative cursor-grab touch-none select-none active:cursor-grabbing ${styles.container}`}
        role="img"
        aria-label={ariaLabel}
      >
        <div
          ref={globeRef}
          className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2"
        >
          <svg
            ref={svgRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-visible"
          >
            <g ref={wireGroupRef} />
          </svg>

          <div
            ref={glowRef}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(167,139,250,0.14), rgba(244,114,182,0.06) 55%, transparent 72%)",
            }}
          />

          {center && (
            <div
              className={`pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full px-2 py-1 text-center shadow-sm ring-1 backdrop-blur-sm ${colors.centerRing}`}
            >
              <span
                className={`font-bold leading-none tabular-nums ${colors.centerValue} ${size === "xl" ? "text-4xl" : size === "lg" ? "text-2xl" : size === "md" ? "text-xl" : "text-sm"}`}
              >
                {center.value}
              </span>
              {center.label && (
                <span
                  className={`mt-0.5 text-[8px] font-medium uppercase tracking-wide ${colors.centerLabel}`}
                >
                  {center.label}
                </span>
              )}
            </div>
          )}

          {nodes.map((node, i) => {
            const NodeIcon = node.icon;

            return (
              <div
                key={`${node.name}-${i}`}
                ref={(el) => {
                  nodeRefs.current[i] = el;
                }}
                className="pointer-events-none absolute left-1/2 top-1/2 flex flex-col items-center gap-1"
                style={{
                  transform: "translate3d(-50%, -50%, 0)",
                  opacity: 0,
                  willChange: "transform, opacity",
                }}
              >
                {NodeIcon ? (
                  <div
                    data-node-badge
                    className={`flex items-center justify-center border border-white/15 bg-white/[0.08] backdrop-blur-sm ${styles.iconBadge}`}
                  >
                    <NodeIcon
                      data-node-icon
                      className={styles.iconSize}
                      style={{ color: node.color }}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </div>
                ) : (
                  <span
                    data-node-dot
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: node.color }}
                  />
                )}
                <span
                  data-node-label
                  className={`flex items-center gap-1 whitespace-nowrap font-semibold ${styles.label} ${colors.label}`}
                >
                  {NodeIcon ? (
                    <NodeIcon
                      data-node-label-icon
                      className={`shrink-0 ${styles.labelIcon}`}
                      style={{ color: node.color }}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  ) : null}
                  {node.name}
                </span>
                <span
                  data-node-value
                  className={`whitespace-nowrap font-bold tabular-nums ${styles.value} ${colors.value}`}
                >
                  {node.value}
                </span>
              </div>
            );
          })}
        </div>

        {dragHint && (
          <p
            className={`pointer-events-none absolute bottom-0 left-0 right-0 text-center font-medium ${styles.hint} ${colors.hint}`}
          >
            {dragHint}
          </p>
        )}
      </div>
    </div>
  );
}
