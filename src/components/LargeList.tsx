import React from "react";

import { grey900, grey600 } from "material-ui/styles/colors";

const largeListStyle: React.CSSProperties = {
  listStyleType: "none",
  margin: 0,
  padding: 0
};

export const LargeList: React.SFC = props => {
  return <ul style={largeListStyle}>{props.children}</ul>;
};

const largeListItemStyles: { [key: string]: React.CSSProperties } = {
  flexContainer: {
    display: "flex",
    alignItems: "center"
  },
  textWrapper: {
    flexGrow: 1
  },
  actionWrapper: {
    flexGrow: 0
  },
  primaryText: {
    margin: "10px 0 0 0",
    padding: 0,
    fontFamily: "Poppins",
    fontSize: "16px",
    color: grey900
  },
  secondaryText: {
    margin: "5px 0 0 0",
    padding: 0,
    fontFamily: "Poppins",
    fontSize: "14px",
    color: grey600
  }
};

export interface LargeListItemProps {
  primaryText?: string;
  secondaryText?: string;
  rightIconButton?: React.ReactNode;
}

export const LargeListItem: React.SFC<LargeListItemProps> = props => {
  const { primaryText, secondaryText, rightIconButton } = props;

  return (
    <li style={largeListItemStyles.flexContainer}>
      <div style={largeListItemStyles.textWrapper}>
        {primaryText && (
          <p style={largeListItemStyles.primaryText}>{primaryText}</p>
        )}
        {secondaryText && (
          <p style={largeListItemStyles.secondaryText}>{secondaryText}</p>
        )}
      </div>
      {rightIconButton && (
        <div style={largeListItemStyles.actionWrapper}>{rightIconButton}</div>
      )}
    </li>
  );
};
