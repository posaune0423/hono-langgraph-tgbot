import { type DAS, Helius, Interface } from "helius-sdk";

export const helius = new Helius(process.env.HELIUS_API_KEY!);

export const getAssetsByOwner = async (
  ownerAddress: string,
  onlyFungible: boolean = true,
): Promise<DAS.GetAssetResponse[]> => {
  const response = await helius.rpc.getAssetsByOwner({
    ownerAddress,
    page: 1,
    displayOptions: {
      showFungible: true,
    },
  });

  if (onlyFungible) {
    return response.items.filter(
      (item) => item.interface === Interface.FUNGIBLE_TOKEN || item.interface === Interface.FUNGIBLE_ASSET,
    );
  }

  return response.items;
};
