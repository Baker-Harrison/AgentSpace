type AgentSpacesLogoProps = {
  className?: string;
};

export function AgentSpacesLogo({ className }: AgentSpacesLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="agentspaces-logo-gradient" x1="10" x2="52" y1="10" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6EE7FF" />
          <stop offset="0.55" stopColor="#4DA2FF" />
          <stop offset="1" stopColor="#7C5CFF" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#08111D" stroke="rgba(140, 174, 214, 0.22)" />
      <path
        d="M18 22.5C18 19.4624 20.4624 17 23.5 17H30.5C33.5376 17 36 19.4624 36 22.5V25H23.5C22.1193 25 21 26.1193 21 27.5V36.5C21 37.8807 22.1193 39 23.5 39H42.5V41.5C42.5 44.5376 40.0376 47 37 47H23.5C20.4624 47 18 44.5376 18 41.5V22.5Z"
        fill="url(#agentspaces-logo-gradient)"
        fillOpacity="0.92"
      />
      <path
        d="M28 22.5C28 19.4624 30.4624 17 33.5 17H40.5C43.5376 17 46 19.4624 46 22.5V41.5C46 44.5376 43.5376 47 40.5 47H33.5C30.4624 47 28 44.5376 28 41.5V39H40.5C41.8807 39 43 37.8807 43 36.5V27.5C43 26.1193 41.8807 25 40.5 25H28V22.5Z"
        fill="#EAF3FF"
        fillOpacity="0.95"
      />
      <path d="M24 31.5H39" stroke="#08111D" strokeLinecap="round" strokeWidth="2.4" />
      <path d="M24 36.5H33" stroke="#08111D" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}
