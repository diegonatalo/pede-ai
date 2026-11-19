import Image from "next/image";
import { cn } from "@/lib/cn";

/** Imagem de quando o item ainda não tem foto: um prato ilustrado, nas cores da marca. */
export const MENU_PHOTO_FALLBACK = "/images/menu-placeholder.svg";

type Props = {
  /** Foto do item; sem ela, aparece a ilustração (as fotos chegam com o envio pelo gerente). */
  src?: string;
  alt: string;
  /** Largura em que a foto aparece, para o `next/image` escolher o tamanho (ex.: "96px"). */
  sizes: string;
  className?: string;
};

/** Foto de um item do cardápio, com a ilustração no lugar enquanto não há foto. */
export const MenuPhoto = ({ src, alt, sizes, className }: Props) => (
  <div className={cn("relative shrink-0 overflow-hidden bg-surface", className)}>
    <Image
      src={src ?? MENU_PHOTO_FALLBACK}
      // A ilustração não mostra o prato: fica fora da leitura de tela.
      alt={src ? alt : ""}
      fill
      sizes={sizes}
      unoptimized={!src}
      className="object-cover"
      data-placeholder={src ? undefined : "true"}
    />
  </div>
);
