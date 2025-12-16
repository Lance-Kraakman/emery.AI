import { getClassNameFactory } from "@/components/puck/lib";

import styles from "./styles.module.css";

const getClassName = getClassNameFactory("Header", styles);

const NavItem = ({ label, href }: { label: string; href: string }) => {
  const navPath =
    typeof window !== "undefined"
      ? window.location.pathname.replace("/edit", "") || "/"
      : "/";

  const isActive = navPath === (href.replace("/edit", "") || "/");

  const El = href ? "a" : "span";

  return (
    <El
      href={href || "/"}
      style={{
        textDecoration: "none",
        color: isActive
          ? "var(--theme-text, #1e293b)"
          : "var(--theme-text-muted, #64748b)",
        fontWeight: isActive ? "600" : "400",
      }}
    >
      {label}
    </El>
  );
};

const Header = ({ editMode }: { editMode: boolean }) => (
  <div className={getClassName()}>
    <header className={getClassName("inner")}>
      <div className={getClassName("logo")}>LOGO</div>
      <nav className={getClassName("items")}>
        <NavItem label="Home" href={`${editMode ? "" : "/"}`} />
        <NavItem label="Pricing" href={editMode ? "" : "/pricing"} />
        <NavItem label="About" href={editMode ? "" : "/about"} />
      </nav>
    </header>
  </div>
);

export { Header };
