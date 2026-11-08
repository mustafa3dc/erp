import * as React from 'react';

interface AvatarContextValue {
  imageLoaded: boolean;
  setImageLoaded: (loaded: boolean) => void;
  hasError: boolean;
  setHasError: (error: boolean) => void;
}

const AvatarContext = React.createContext<AvatarContextValue>({
  imageLoaded: false,
  setImageLoaded: () => {},
  hasError: false,
  setHasError: () => {}
});

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = '', style, children, ...props }, ref) => {
    const [imageLoaded, setImageLoaded] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);

    return (
      <AvatarContext.Provider value={{ imageLoaded, setImageLoaded, hasError, setHasError }}>
        <div
          ref={ref}
          className={`relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full ${className}`}
          style={{
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            ...style
          }}
          {...props}
        >
          {children}
        </div>
      </AvatarContext.Provider>
    );
  }
);
Avatar.displayName = 'Avatar';

export interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

export const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className = '', style, src, alt, ...props }, ref) => {
    const { imageLoaded, setImageLoaded, hasError, setHasError } = React.useContext(AvatarContext);
    const [currentSrc, setCurrentSrc] = React.useState(src);

    React.useEffect(() => {
      setCurrentSrc(src);
      setImageLoaded(false);
      setHasError(false);
    }, [src, setImageLoaded, setHasError]);

    if (hasError || !currentSrc) {
      return null;
    }

    const handleError = () => {
      // Direct rock-solid fallback to curated 3D Memoji
      if (currentSrc !== '/avatars/memoji-01.png') {
        setCurrentSrc('/avatars/memoji-01.png');
      } else {
        setHasError(true);
        setImageLoaded(false);
      }
    };

    const handleLoad = () => {
      setImageLoaded(true);
      setHasError(false);
    };

    return (
      <img
        ref={ref}
        src={currentSrc}
        alt={alt || 'Avatar'}
        onLoad={handleLoad}
        onError={handleError}
        className={`aspect-square h-full w-full object-cover ${className}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...style
        }}
        {...props}
      />
    );
  }
);
AvatarImage.displayName = 'AvatarImage';

export interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className = '', style, children, ...props }, ref) => {
    const { imageLoaded } = React.useContext(AvatarContext);

    // If image has loaded successfully, hide fallback completely
    if (imageLoaded) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={`flex h-full w-full items-center justify-center rounded-full bg-muted font-bold select-none ${className}`}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          ...style
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AvatarFallback.displayName = 'AvatarFallback';

export default Avatar;
