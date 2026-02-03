"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/context/ProfileContext";
import { useRouter } from "next/navigation";

export default function UsernameNotificationBanner() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Détecter si un modal est ouvert (comme EditProfileModal)
  useEffect(() => {
    const checkModal = () => {
      setIsModalOpen(document.body.hasAttribute("data-modal-open"));
    };
    
    // Vérifier au montage
    checkModal();
    
    // Observer les changements d'attribut
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-modal-open"]
    });
    
    return () => observer.disconnect();
  }, []);

  // Ne pas afficher pendant le chargement ou si pas de profil
  if (loading || !profile) {
    return null;
  }

  // Vérifier si les champs sont remplis
  const hasUsername = profile.username && profile.username.trim().length > 0;
  const hasDisplayName = profile.display_name && profile.display_name.trim().length > 0;
  
  // La bannière disparaît si les deux sont remplis OU si un modal est ouvert
  const shouldHide = (hasUsername && hasDisplayName) || isModalOpen;

  if (shouldHide) {
    return null;
  }

  const handleEditClick = () => {
    // Naviguer vers le profil et déclencher l'ouverture du modal
    router.push('/profile?edit=true');
    // Également déclencher un événement personnalisé pour être sûr
    window.dispatchEvent(new CustomEvent('openEditProfileModal'));
  };

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/40 px-4 py-3 flex items-center justify-between gap-3 relative z-40">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-300 mb-0.5">
          Complète ton profil
        </p>
        <p className="text-xs text-amber-200/80">
          Ajouter votre nom et nom d'utilisateur pour finaliser votre profil
        </p>
      </div>
      <button
        onClick={handleEditClick}
        className="px-3 py-1.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors whitespace-nowrap flex-shrink-0"
      >
        Modifier
      </button>
    </div>
  );
}
