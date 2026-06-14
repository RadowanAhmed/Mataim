import React from 'react'
import { Text, TextProps, StyleProp, TextStyle } from 'react-native'

type Weight = 'regular' | 'medium' | 'bold' | 'heavy' | 'black'

const weightMap: Record<Weight, TextStyle['fontWeight']> = {
    regular: '500',
    medium: '600',
    bold: '700',
    heavy: '800',
    black: '800',
}

export interface AppTextProps extends TextProps {
    weight?: Weight
    style?: StyleProp<TextStyle>
}

export default function AppText({ weight = 'regular', style, children, ...rest }: AppTextProps) {
    return (
        <Text
            {...rest}
            style={[style, { fontFamily: 'Inter', fontWeight: weightMap[weight] as any }]}
        >
            {children}
        </Text>
    )
}
