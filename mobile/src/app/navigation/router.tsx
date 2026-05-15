/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';

export type RootStackParamList = {
  Bootstrap: undefined;
  Meeting: undefined;
  History: undefined;
  SessionReview: {sessionId: string; fallbackSession?: unknown; fallbackUtterances?: unknown[]};
  Settings: undefined;
  ModelRepository: undefined;
};

type RouteName = keyof RootStackParamList;

type RouteState<T extends RouteName = RouteName> = {
  name: T;
  params: RootStackParamList[T];
};

type AppNavigation = {
  navigate: <T extends RouteName>(
    name: T,
    ...args: RootStackParamList[T] extends undefined ? [] : [params: RootStackParamList[T]]
  ) => void;
  replace: <T extends RouteName>(
    name: T,
    ...args: RootStackParamList[T] extends undefined ? [] : [params: RootStackParamList[T]]
  ) => void;
  goBack: () => void;
  reset: (state: {index: number; routes: Array<{name: RouteName; params?: RootStackParamList[RouteName]}>}) => void;
};

type RouterContextValue = {
  route: RouteState;
  navigation: AppNavigation;
};

const RouterContext = createContext<RouterContextValue | null>(null);

export function AppRouterProvider({children}: {children: React.ReactNode}) {
  const [stack, setStack] = useState<RouteState[]>([{name: 'History', params: undefined}]);

  const navigate = useCallback(<T extends RouteName>(name: T, ...args: RootStackParamList[T] extends undefined ? [] : [params: RootStackParamList[T]]) => {
    const params = (args[0] ?? undefined) as RootStackParamList[T];
    console.warn('[Router] navigate called:', name, 'params sessionId=', (params as any)?.sessionId);
    setStack(prev => {
      const newStack = [...prev, {name, params: (params ?? undefined) as RootStackParamList[T]}];
      console.warn('[Router] navigate: stack before=', prev.map(s => s.name), 'after=', newStack.map(s => s.name));
      return newStack;
    });
  }, []);

  const replace = useCallback(<T extends RouteName>(name: T, ...args: RootStackParamList[T] extends undefined ? [] : [params: RootStackParamList[T]]) => {
    const params = (args[0] ?? undefined) as RootStackParamList[T];
    setStack(prev => [...prev.slice(0, -1), {name, params: (params ?? undefined) as RootStackParamList[T]}]);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback((state: {index: number; routes: Array<{name: RouteName; params?: RootStackParamList[RouteName]}>}) => {
    const nextStack = state.routes.map(route => ({
      name: route.name,
      params: route.params,
    })) as RouteState[];
    setStack(nextStack.length > 0 ? nextStack.slice(0, state.index + 1) : [{name: 'History', params: undefined}]);
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      route: stack[stack.length - 1],
      navigation: {navigate, replace, goBack, reset},
    }),
    [stack, navigate, replace, goBack, reset],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useNavigation<T = AppNavigation>(): T {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useNavigation must be used inside AppRouterProvider');
  }
  return ctx.navigation as T;
}

export function useRoute<T = RouteState>(): T {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRoute must be used inside AppRouterProvider');
  }
  return ctx.route as T;
}

export type StackNavigationProp<ParamList, _Current extends keyof ParamList> = AppNavigation;
export type RouteProp<ParamList, Current extends keyof ParamList> = {
  key?: string;
  name: Current;
  params: ParamList[Current];
};
