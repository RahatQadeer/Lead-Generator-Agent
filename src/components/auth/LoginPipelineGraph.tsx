"use client";

import {
  Mail,
  MessageSquare,
  Search,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { SphereUniverseGraph } from "@/components/dashboard/SphereUniverseGraph";

export const PIPELINE_NODES = [
  { name: "Search", color: "#a78bfa", value: "Discover", icon: Search },
  { name: "Leads", color: "#38bdf8", value: "Enrich", icon: Users },
  { name: "Score", color: "#34d399", value: "Rank", icon: Target },
  { name: "Email", color: "#fbbf24", value: "Send", icon: Mail },
  { name: "Reply", color: "#fb7185", value: "Track", icon: MessageSquare },
  { name: "Convert", color: "#22d3ee", value: "Close", icon: TrendingUp },
] as const;

function PipelineWireframe() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 320 148"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="login-pipeline-wire"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.7" />
          <stop offset="45%" stopColor="#f472b6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path
        d="M 53 38 L 160 38 L 267 38 L 267 74 L 53 110 L 160 110 L 267 110"
        stroke="url(#login-pipeline-wire)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="5 7"
        className="login-pipeline-wire"
        opacity="0.85"
      />
    </svg>
  );
}

function PipelineNode({
  name,
  color,
  value,
  index,
  icon: Icon,
}: {
  name: string;
  color: string;
  value: string;
  index: number;
  icon: (typeof PIPELINE_NODES)[number]["icon"];
}) {
  return (
    <li
      className="login-pipeline-node relative flex flex-col items-center"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative">
        <div
          className="absolute -inset-2 rounded-2xl opacity-40 blur-lg"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm"
          style={{ boxShadow: `0 0 12px ${color}44` }}
        >
          <Icon
            className="h-5 w-5"
            style={{ color }}
            strokeWidth={2.25}
            aria-hidden
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-none text-white sm:text-xs">
        {name}
      </p>
      <p
        className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] sm:text-[10px]"
        style={{ color }}
      >
        {value}
      </p>
    </li>
  );
}

export function LoginPipelineSteps({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`.trim()}>
      <style>{`
        @keyframes login-pipeline-dash {
          to { stroke-dashoffset: -24; }
        }
        @keyframes login-pipeline-node-in {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .login-pipeline-wire {
          animation: login-pipeline-dash 2.4s linear infinite;
        }
        .login-pipeline-node {
          animation: login-pipeline-node-in 0.55s ease backwards;
        }
      `}</style>

      <div
        className="pointer-events-none absolute -inset-3 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.1),transparent_72%)]"
        aria-hidden
      />

      <div className="relative rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent px-3 py-4 sm:px-4 sm:py-5">
        <PipelineWireframe />
        <ol className="relative z-10 grid grid-cols-3 gap-x-2 gap-y-7 sm:gap-x-3 sm:gap-y-8">
          {PIPELINE_NODES.map((node, index) => (
            <PipelineNode key={node.name} index={index} {...node} />
          ))}
        </ol>
      </div>
    </div>
  );
}

export function LoginPipelineGraph() {
  return (
    <div className="w-full">
      <SphereUniverseGraph
        size="xl"
        theme="dark"
        nodes={PIPELINE_NODES.map((node) => ({
          name: node.name,
          color: node.color,
          value: node.value,
          icon: node.icon,
        }))}
        center={{ value: "6", label: "Stages" }}
        dragHint="Drag to explore the pipeline"
        ariaLabel="Interactive lead generation pipeline. Drag to rotate."
      />
    </div>
  );
}
