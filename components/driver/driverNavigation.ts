type DriverRouter = {
  back?: () => void;
  canGoBack?: () => boolean;
  replace?: (route: any) => void;
};

export function goBackOrDriverFallback(
  router: DriverRouter,
  fallback: any = "/(driver)/dashboard",
) {
  if (router?.canGoBack?.()) {
    router.back?.();
    return;
  }

  router.replace?.(fallback);
}
