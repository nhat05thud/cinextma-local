"use client";

import { Button, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from "@heroui/react";
import { Youtube } from "@/utils/icons";
import { youtubeId } from "@/lib/media";

const Trailer: React.FC<{ url: string | null; title: string }> = ({ url, title }) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const id = youtubeId(url);
  if (!id) return null;

  return (
    <>
      <Button variant="faded" onPress={onOpen} startContent={<Youtube size={20} className="text-danger" />}>
        Trailer
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" backdrop="blur" placement="center">
        <ModalContent>
          <ModalHeader>Trailer — {title}</ModalHeader>
          <ModalBody className="pb-6">
            <div className="aspect-video w-full overflow-hidden rounded-lg">
              <iframe
                className="size-full"
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
                title={`Trailer ${title}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default Trailer;
