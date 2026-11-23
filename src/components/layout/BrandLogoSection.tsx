import React from "react";

export const BrandLogoSection: React.FC = () => {
  return (
    <div className="flex items-center justify-center px-4 py-4 bg-transparent">
      <img
        src="/logo.png"
        alt="Hospital Logo"
        className="w-full max-w-[210px] h-auto object-contain block select-none bg-transparent"
      />
    </div>
  );
};
