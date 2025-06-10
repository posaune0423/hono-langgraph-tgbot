import { type DAS, Helius } from "helius-sdk";

export const helius = new Helius(process.env.HELIUS_API_KEY!);

export const getAssetsByOwner = async (ownerAddress: string): Promise<DAS.GetAssetResponse[]> => {
  const response = await helius.rpc.getAssetsByOwner({
    ownerAddress,
    page: 1,
    displayOptions: {
      showFungible: true,
    },
  });

  return response.items;
};
